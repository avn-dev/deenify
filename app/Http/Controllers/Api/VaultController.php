<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VaultRequest;

class VaultController extends Controller
{
    public function init(VaultRequest $request)
    {
        $validated = $request->validated();

        $user = $request->user();

        if ($user->encrypted_dek) {
            return response()->json([
                'message' => 'Vault already initialized.',
            ], 409);
        }

        $user->fill($validated);
        $user->save();

        return response()->json(['status' => 'ok']);
    }

    public function rotate(VaultRequest $request)
    {
        $validated = $request->validated();

        $user = $request->user();
        $user->fill($validated);
        $user->save();

        return response()->json(['status' => 'ok']);
    }
}
