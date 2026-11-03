import { test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderApp } from './utils.jsx'

test('la app muestra el logo de FINO', async () => {
  mockApi()
  renderApp('/')
  expect(await screen.findByAltText('FINO')).toBeInTheDocument()
})
