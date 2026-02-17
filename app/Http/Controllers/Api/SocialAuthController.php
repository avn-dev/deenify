<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\Response;

class SocialAuthController extends Controller
{
    /**
     * @param string $provider
     */
    public function redirect(string $provider)
    {
        $this->ensureProvider($provider);

        return Socialite::driver($provider)->redirect();
    }

    /**
     * @param string $provider
     */
    public function callback(Request $request, string $provider)
    {
        $this->ensureProvider($provider);

        $socialUser = Socialite::driver($provider)->user();
        $email = $socialUser->getEmail();

        if (! $email) {
            return response()->json([
                'message' => 'Vom Anbieter wird eine E-Mail-Adresse benötigt.',
            ], 422);
        }

        $user = $this->findOrCreateUser($provider, $socialUser->getId(), $email, $socialUser->getName());

        Auth::login($user);
        $request->session()->regenerate();

        $redirectTo = rtrim(config('app.url'), '/');
        $frontendUrl = env('FRONTEND_APP_URL');
        if (is_string($frontendUrl) && $frontendUrl !== '') {
            $redirectTo = rtrim($frontendUrl, '/');
        }

        return redirect()->to($redirectTo.'/auth/callback');
    }

    protected function findOrCreateUser(string $provider, string $providerId, string $email, ?string $name): User
    {
        $user = User::query()
            ->where("providers->{$provider}->id", $providerId)
            ->first();

        if ($user) {
            return $user;
        }

        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            $user = User::create([
                'email' => $email,
                'username' => $this->generateUsername($email, $name),
            ]);
        }

        $providers = $user->providers ?? [];
        $providers[$provider] = array_filter([
            'id' => $providerId,
            'name' => $name,
        ]);

        if (! $user->username) {
            $user->username = $this->generateUsername($email, $name);
        }

        $user->providers = $providers;
        $user->save();

        return $user;
    }

    protected function ensureProvider(string $provider): void
    {
        if (! in_array($provider, ['google', 'apple'], true)) {
            abort(Response::HTTP_NOT_FOUND);
        }
    }

    protected function generateUsername(string $email, ?string $name): string
    {
        $base = $name ?: $email;
        $base = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', $base) ?? 'user');
        $base = trim($base, '_');
        if ($base === '') {
            $base = 'user';
        }

        $candidate = $base;
        $suffix = 1;
        while (User::query()->where('username', $candidate)->exists()) {
            $suffix += 1;
            $candidate = $base.$suffix;
        }

        return $candidate;
    }
}
