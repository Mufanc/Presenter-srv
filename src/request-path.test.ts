import assert from 'node:assert/strict'
import test from 'node:test'
import { backendKind } from './fs/index.ts'
import { isResetPath, requestPath } from './request-path.ts'

test('maps navigation and asset requests to package paths', () => {
    assert.equal(requestPath('https://presenter.test/42', true), 'index.html')
    assert.equal(requestPath('https://presenter.test/assets/app.js?v=1', false), 'assets/app.js')
    assert.equal(isResetPath('https://presenter.test/ncr'), true)
    assert.equal(isResetPath('https://presenter.test/ncr?reset'), true)
    assert.equal(isResetPath('https://presenter.test/ncr/'), false)
})

test('selects a backend from the dropped handle', () => {
    assert.equal(backendKind({ kind: 'directory', name: 'web-app' }), 'directory')
    assert.equal(backendKind({ kind: 'file', name: 'slides.ZIP' }), 'zip')
    assert.equal(backendKind({ kind: 'file', name: 'slides.TAR' }), 'tar')
    assert.equal(backendKind({ kind: 'file', name: 'slides.tgz' }), null)
})
