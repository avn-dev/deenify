<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PreferenceRequest;
use App\Models\Preference;
use Illuminate\Http\Request;

class PreferenceController extends Controller
{
    public function show(Request $request)
    {
        $preference = Preference::query()->where('user_id', $request->user()->id)->first();

        if (! $preference) {
            return response()->json(['preference' => null]);
        }

        return response()->json([
            'preference' => [
                'ciphertext' => $preference->ciphertext,
                'iv' => $preference->iv,
            ],
        ]);
    }

    public function upsert(PreferenceRequest $request)
    {
        $userId = $request->user()->id;

        $preference = Preference::updateOrCreate(
            ['user_id' => $userId],
            $request->validated(),
        );

        $this->authorize('update', $preference);

        return response()->json(['status' => 'ok']);
    }
}
