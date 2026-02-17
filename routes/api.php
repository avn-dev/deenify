<?php

use App\Http\Controllers\Api\EntryController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PreferenceController;
use App\Http\Controllers\Api\VaultController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function () {
    Route::get('/me', [MeController::class, 'show']);
    Route::patch('/me', [MeController::class, 'update']);

    Route::post('/vault/init', [VaultController::class, 'init']);
    Route::post('/vault/rotate', [VaultController::class, 'rotate']);

    Route::get('/entries', [EntryController::class, 'index']);
    Route::post('/entries', [EntryController::class, 'store']);
    Route::get('/entries/{entry}', [EntryController::class, 'show']);
    Route::patch('/entries/{entry}', [EntryController::class, 'update']);
    Route::delete('/entries/{entry}', [EntryController::class, 'destroy']);

    Route::get('/preferences', [PreferenceController::class, 'show']);
    Route::put('/preferences', [PreferenceController::class, 'upsert']);
});
