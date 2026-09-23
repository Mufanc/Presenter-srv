import assert from 'node:assert/strict'
import test from 'node:test'
import { isResetPath, requestPath } from './request-path.ts'

test('maps navigation and asset requests to package paths', () => {
    assert.equal(requestPath('https://presenter.test/42', true), 'index.html')
    assert.equal(requestPath('https://presenter.test/assets/app.js?v=1', false), 'assets/app.js')
    assert.equal(isResetPath('https://presenter.test/ncr'), true)
    assert.equal(isResetPath('https://presenter.test/ncr?reset'), true)
    assert.equal(isResetPath('https://presenter.test/ncr/'), false)
})
