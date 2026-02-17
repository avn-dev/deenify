<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateEntryRequest extends FormRequest
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
            'day' => ['sometimes', 'date'],
            'ciphertext' => ['sometimes', 'string'],
            'iv' => ['sometimes', 'string'],
            'aad' => ['nullable', 'array'],
        ];
    }
}
