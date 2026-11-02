import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSession, displayValues, selectedPixel, upload, validWindow } from '../src/lib/pixel-api.ts';

const cell = { x: 0, y: 0, rgba: [255, 0, 128, 64], values: [255, 0, 128, 64] };
const window = { x: 0, y: 0, start_x: 0, start_y: 0, rows: [[cell]] };
const session = { id: 'a'.repeat(32), name: 'test.png', width: 1, height: 1, channels: 4, sample_depth: 8, window };

test('zero coordinate and transparent pixels are valid', () => {
  assert.equal(validWindow(window), true);
  assert.equal(selectedPixel(window), cell);
  assert.doesNotThrow(() => assertSession(session));
});
test('16-bit grayscale alpha is preserved in numeric inspection', () => {
  assert.deepEqual(displayValues({ ...cell, values: [257, 32768] }, 16), [257, 257, 257, 32768]);
  assert.deepEqual(displayValues({ ...cell, values: [1, 2, 3] }, 16), [1, 2, 3, 65535]);
});
test('invalid pixel data is rejected', () => {
  assert.equal(validWindow({ ...window, rows: [[{ ...cell, rgba: [256, 0, 0, 255] }]] }), false);
  assert.equal(validWindow({ ...window, rows: [] }), false);
  assert.equal(validWindow({ ...window, rows: [[{ ...cell, values: [NaN] }]] }), false);
  assert.throws(() => assertSession({ ...session, id: '../server.py' }));
});
test('missing selection fails instead of reading the wrong pixel', () => {
  assert.throws(() => selectedPixel({ ...window, x: 3 }));
  assert.throws(() => assertSession({ ...session, window: { ...window, x: 3 } }));
});

function xhrStub() {
  let last;
  class FakeXHR {
    upload = {};
    status = 200;
    responseText = JSON.stringify(session);
    constructor() { last = this; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader() {}
    send(file) { this.file = file; }
    abort() { this.onabort?.(); }
  }
  globalThis.XMLHttpRequest = FakeXHR;
  return () => last;
}
test('upload sends file body with a safely encoded filename', async () => {
  const last = xhrStub();
  const file = new File(['png'], 'a & b.png');
  const controller = new AbortController();
  let progress = 0;
  const request = upload(file, 'decode', { signal: controller.signal, onProgress: value => { progress = value; } });
  assert.equal(last().file, file);
  assert.equal(last().method, 'POST');
  assert.match(last().url, /a%20%26%20b\.png$/);
  last().upload.onprogress({ lengthComputable: true, loaded: 1, total: 2 });
  assert.equal(progress, 50);
  last().onload();
  assert.equal((await request).id, session.id);
});
test('upload abort rejects with AbortError and never completes successfully', async () => {
  const last = xhrStub();
  const controller = new AbortController();
  const request = upload(new File(['x'], 'test.png'), 'decode', { signal: controller.signal, onProgress() {} });
  controller.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
  assert.ok(last());
});
test('server errors remain readable and malformed responses are rejected', async () => {
  const last = xhrStub();
  const context = { signal: new AbortController().signal, onProgress() {} };
  const failed = upload(new File(['x'], 'test.png'), 'decode', context);
  last().status = 400; last().responseText = JSON.stringify({ error: 'فایل معتبر نیست.' }); last().onload();
  await assert.rejects(failed, /فایل معتبر نیست/);
  const malformed = upload(new File(['x'], 'test.png'), 'decode', context);
  last().responseText = 'not JSON'; last().onload();
  await assert.rejects(malformed);
});
