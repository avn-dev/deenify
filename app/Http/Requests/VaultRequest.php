<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VaultRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'kdf_salt' => ['required', 'string'],
            'kdf_params' => ['required', 'array'],
            'encrypted_dek' => ['required', 'string'],
            'dek_iv' => ['required', 'string'],
        ];
    }
}
