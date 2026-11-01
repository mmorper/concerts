import { Component, type ErrorInfo, type ReactNode } from 'react'
import { SCENE_LABELS } from './changelog/constants'
import { analytics } from '../services/analytics'

interface SceneErrorBoundaryProps {
  /** Scene slug from SCENE_NAMES, e.g. 'geography'. */
  scene: string
  children: ReactNode
}

interface SceneErrorBoundaryState {
  hasError: boolean
}

/**
 * Keeps one scene's error inside that scene. Without a boundary React unmounts the whole
 * tree on an uncaught error, and because every scene shares one page, that empties #root.
 *
 * The fallback is a full-height snap section so the scenes after it stay at the scroll
 * offsets that navigation and deep links compute from the scene's position.
 */
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SceneErrorBoundary] ${this.props.scene} failed:`, error, info.componentStack)

    analytics.trackEvent('scene_error_caught', {
      scene_name: this.props.scene,
      error_message: error.message.slice(0, 100),
    })
  }

  handleRetry = () => {
    analytics.trackEvent('scene_retry_clicked', { scene_name: this.props.scene })
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <section
        data-testid="scene-error"
        className="h-screen flex flex-col items-center justify-center bg-gray-900 px-6 text-center snap-start snap-always"
      >
        <h2 className="font-serif text-3xl md:text-5xl text-white mb-3 tracking-tight">
          {SCENE_LABELS[this.props.scene]} didn't load
        </h2>
        <p className="font-sans text-lg text-gray-400 mb-6">The rest of the archive still works.</p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="font-sans text-sm text-white px-5 py-3 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
        >
          Try again
        </button>
      </section>
    )
  }
}
