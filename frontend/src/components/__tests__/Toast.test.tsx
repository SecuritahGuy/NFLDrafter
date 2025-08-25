import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ToastProvider, useToast, ToastContainer } from '../Toast'

// Test component that uses the toast hook
const TestToastComponent = () => {
  const { addToast, removeToast, clearAll } = useToast()

  return (
    <div>
      <button onClick={() => addToast({ type: 'success', title: 'Success!', message: 'Operation completed' })}>
        Add Success Toast
      </button>
      <button onClick={() => addToast({ type: 'error', title: 'Error!', message: 'Something went wrong' })}>
        Add Error Toast
      </button>
      <button onClick={() => addToast({ type: 'warning', title: 'Warning!', message: 'Please be careful' })}>
        Add Warning Toast
      </button>
      <button onClick={() => addToast({ type: 'info', title: 'Info!', message: 'Here is some information' })}>
        Add Info Toast
      </button>
      <button onClick={() => addToast({ type: 'success', title: 'Action Toast', message: 'With action', action: { label: 'Undo', onClick: () => {} } })}>
        Add Action Toast
      </button>
      <button onClick={() => addToast({ type: 'success', title: 'Persistent Toast', message: 'This will not auto-dismiss', duration: 0 })}>
        Add Persistent Toast
      </button>
      <button onClick={() => clearAll()}>
        Clear All Toasts
      </button>
    </div>
  )
}

describe('Toast System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('ToastProvider and useToast', () => {
    it('renders without crashing', () => {
      render(
        <ToastProvider>
          <div>Test Content</div>
        </ToastProvider>
      )
      
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('provides toast context to children', () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      expect(screen.getByText('Add Success Toast')).toBeInTheDocument()
      expect(screen.getByText('Add Error Toast')).toBeInTheDocument()
    })
  })

  describe('Toast Functionality', () => {
    it('adds a success toast', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Success Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument()
        expect(screen.getByText('Operation completed')).toBeInTheDocument()
      })
    })

    it('adds an error toast', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Error Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByText('Error!')).toBeInTheDocument()
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })
    })

    it('adds a warning toast', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Warning Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByText('Warning!')).toBeInTheDocument()
        expect(screen.getByText('Please be careful')).toBeInTheDocument()
      })
    })

    it('adds an info toast', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Info Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByText('Info!')).toBeInTheDocument()
        expect(screen.getByText('Here is some information')).toBeInTheDocument()
      })
    })

    it('adds a toast with actions', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Action Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByText('Action Toast')).toBeInTheDocument()
        expect(screen.getByText('With action')).toBeInTheDocument()
        expect(screen.getByText('Undo')).toBeInTheDocument()
      })
    })

    it('adds a persistent toast', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Persistent Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        expect(screen.getByText('Persistent Toast')).toBeInTheDocument()
        expect(screen.getByText('This will not auto-dismiss')).toBeInTheDocument()
      })
    })

    it('clears all toasts', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      // Add a few toasts first
      const addSuccessButton = screen.getByText('Add Success Toast')
      const addErrorButton = screen.getByText('Add Error Toast')
      
      fireEvent.click(addSuccessButton)
      fireEvent.click(addErrorButton)
      
      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument()
        expect(screen.getByText('Error!')).toBeInTheDocument()
      })
      
      // Clear all toasts
      const clearButton = screen.getByText('Clear All Toasts')
      fireEvent.click(clearButton)
      
      await waitFor(() => {
        expect(screen.queryByText('Success!')).not.toBeInTheDocument()
        expect(screen.queryByText('Error!')).not.toBeInTheDocument()
      })
    })
  })

  describe('Toast Styling and Accessibility', () => {
    it('has proper ARIA labels', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Success Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        const dismissButton = screen.getByLabelText('Dismiss notification')
        expect(dismissButton).toBeInTheDocument()
      })
    })

    it('applies correct border styling', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Success Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        // Find the toast container by looking for the element with the success styling
        const toast = screen.getByText('Success!').closest('div')?.parentElement?.parentElement
        expect(toast).toHaveClass('border-green-400')
      })
    })

    it('applies correct shadow and rounded corners', async () => {
      render(
        <ToastProvider>
          <TestToastComponent />
        </ToastProvider>
      )
      
      const addButton = screen.getByText('Add Success Toast')
      fireEvent.click(addButton)
      
      await waitFor(() => {
        // Find the toast container by looking for the element with the success styling
        const toast = screen.getByText('Success!').closest('div')?.parentElement?.parentElement
        expect(toast).toHaveClass('shadow-lg', 'rounded-lg')
      })
    })
  })

  describe('ToastContainer', () => {
    it('renders toast container', () => {
      render(
        <ToastProvider>
          <ToastContainer toasts={[]} onDismiss={() => {}} />
        </ToastProvider>
      )
      
      // Look for the container by its classes instead of role
      const container = document.querySelector('.fixed.top-4.right-4.z-50.space-y-3')
      expect(container).toBeInTheDocument()
    })
  })
})
