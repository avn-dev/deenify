<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEntryRequest;
use App\Http\Requests\UpdateEntryRequest;
use App\Models\Entry;
use Illuminate\Http\Request;

class EntryController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'start' => ['nullable', 'date'],
            'end' => ['nullable', 'date'],
        ]);

        $query = Entry::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('day')
            ->orderByDesc('updated_at');

        if ($request->filled('start')) {
            $query->whereDate('day', '>=', $request->input('start'));
        }

        if ($request->filled('end')) {
            $query->whereDate('day', '<=', $request->input('end'));
        }

        return response()->json([
            'entries' => $query->get()->map(fn (Entry $entry) => $this->payload($entry)),
        ]);
    }

    public function store(StoreEntryRequest $request)
    {
        $payload = $request->validated();
        $entry = Entry::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'day' => $payload['day'],
            ],
            [
                'ciphertext' => $payload['ciphertext'],
                'iv' => $payload['iv'],
                'aad' => $payload['aad'] ?? null,
            ],
        );

        return response()->json([
            'entry' => $this->payload($entry),
        ], 201);
    }

    public function show(Entry $entry)
    {
        $this->authorize('view', $entry);

        return response()->json([
            'entry' => $this->payload($entry),
        ]);
    }

    public function update(UpdateEntryRequest $request, Entry $entry)
    {
        $this->authorize('update', $entry);

        $entry->fill($request->validated());
        $entry->save();

        return response()->json([
            'entry' => $this->payload($entry),
        ]);
    }

    public function destroy(Entry $entry)
    {
        $this->authorize('delete', $entry);

        $entry->delete();

        return response()->json(['status' => 'ok']);
    }

    protected function payload(Entry $entry): array
    {
        return [
            'id' => $entry->id,
            'day' => $entry->day?->toDateString(),
            'ciphertext' => $entry->ciphertext,
            'iv' => $entry->iv,
            'aad' => $entry->aad,
            'created_at' => $entry->created_at?->toISOString(),
            'updated_at' => $entry->updated_at?->toISOString(),
        ];
    }
}
