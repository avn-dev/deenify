<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'username' => ['required', 'alpha_dash', 'min:3', 'max:30', 'unique:users,username'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
        ]);

        $user = User::create([
            'username' => strtolower($validated['username']),
            'email' => $validated['email'] ?? null,
            'password' => Hash::make($validated['password']),
        ]);

        Auth::login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json([
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required'],
        ]);

        if (! Auth::attempt(['username' => strtolower($validated['username']), 'password' => $validated['password']], $request->boolean('remember'))) {
            return response()->json([
                'message' => 'Benutzername oder Passwort ist ungültig.',
            ], 422);
        }

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json([
            'user' => $this->userPayload($request->user()),
        ]);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['status' => 'ok']);
    }

    protected function userPayload(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'profile_ciphertext' => $user->profile_ciphertext,
            'profile_iv' => $user->profile_iv,
            'vault' => [
                'kdf_salt' => $user->kdf_salt,
                'kdf_params' => $user->kdf_params,
                'encrypted_dek' => $user->encrypted_dek,
                'dek_iv' => $user->dek_iv,
            ],
        ];
    }
}
