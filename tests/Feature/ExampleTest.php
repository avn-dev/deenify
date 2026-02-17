<?php

beforeEach(function () {
    $this->markTestSkipped('Legacy Fortify/Inertia Tests.');
});

test('returns a successful response', function () {
    $response = $this->get(route('home'));

    $response->assertOk();
});