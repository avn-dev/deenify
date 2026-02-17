<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();

        return response()->json([
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
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'profile_ciphertext' => ['required', 'string'],
            'profile_iv' => ['required', 'string'],
        ]);

        $user = $request->user();
        $user->fill($validated);
        $user->save();

        return response()->json(['status' => 'ok']);
    }
}
