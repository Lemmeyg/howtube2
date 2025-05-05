import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // Log error to monitoring service if needed
    // console.error(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center py-8">
            <h2 className="text-lg font-semibold mb-2">Something went wrong.</h2>
            <pre className="text-sm text-destructive mb-4">{this.state.error?.message}</pre>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
              onClick={this.handleReset}
            >
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
