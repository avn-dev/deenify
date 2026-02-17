<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SocialAuthController;

Route::prefix('api/auth')->middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

    Route::get('/{provider}/redirect', [SocialAuthController::class, 'redirect']);
    Route::match(['get', 'post'], '/{provider}/callback', [SocialAuthController::class, 'callback']);
});

Route::view('/', 'spa')->name('home');
Route::view('/{any}', 'spa')->where('any', '^(?!api|sanctum).*$');
