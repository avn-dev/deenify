<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEntryRequest extends FormRequest
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
            'day' => ['required', 'date'],
            'ciphertext' => ['required', 'string'],
            'iv' => ['required', 'string'],
            'aad' => ['nullable', 'array'],
        ];
    }
}
