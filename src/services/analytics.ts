// src/services/analytics.ts

interface EventParams {
  [key: string]: string | number | boolean | undefined;
}

// GTags type (extends window)
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

class AnalyticsService {
  private enabled: boolean;
  private measurementId: string | undefined;

  constructor() {
    this.measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    this.enabled = !!this.measurementId && import.meta.env.PROD;

    if (import.meta.env.DEV) {
      console.log('[Analytics] Service initialized', {
        enabled: this.enabled,
        measurementId: this.measurementId ? '***' : 'not set',
      });
    }
  }

  /**
   * Track a custom event
   * @param eventName - Snake_case event name (e.g., 'venue_node_clicked')
   * @param params - Event parameters as key-value pairs
   */
  trackEvent(eventName: string, params?: EventParams): void {
    // Development: Always log to console
    if (import.meta.env.DEV) {
      console.log(`[Analytics] ${eventName}`, params || '(no params)');
    }

    // Production: Send to GA4 if enabled
    if (this.enabled && window.gtag) {
      try {
        window.gtag('event', eventName, {
          ...params,
          // Add automatic parameters
          send_to: this.measurementId,
        });
      } catch (error) {
        console.error('[Analytics] Failed to track event:', error);
      }
    }
  }

  /**
   * Track virtual page view (for SPAs)
   * @param pagePath - Virtual page path (e.g., '/?scene=timeline')
   * @param pageTitle - Human-readable title
   */
  trackPageView(pagePath: string, pageTitle: string): void {
    // Development: Always log to console
    if (import.meta.env.DEV) {
      console.log(`[Analytics] pageview`, { page_path: pagePath, page_title: pageTitle });
    }

    // Production: Send to GA4 using config (proper virtual pageview)
    if (this.enabled && window.gtag) {
      try {
        window.gtag('config', this.measurementId, {
          page_path: pagePath,
          page_title: pageTitle,
        });
      } catch (error) {
        console.error('[Analytics] Failed to track pageview:', error);
      }
    }
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();
