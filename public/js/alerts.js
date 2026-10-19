/**
 * public/js/alerts.js — Client Price Alerts Manager
 *
 * Persists target price alerts to server when logged in, or localStorage for guest shoppers.
 */

import { AuthState } from './auth.js';
import { fetchAlerts, addPriceAlert, removePriceAlert } from './api.js';

const GUEST_ALERTS_KEY = 'haggle_guest_alerts';

export const PriceAlerts = {
  async getAlerts() {
    const token = AuthState.getToken();
    if (token) {
      try {
        const data = await fetchAlerts(token);
        return data.alerts || [];
      } catch (err) {
        console.warn('Failed to load server alerts, falling back to local:', err);
      }
    }

    try {
      const local = localStorage.getItem(GUEST_ALERTS_KEY);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  async setAlert(alertData) {
    if (!alertData) return false;
    const token = AuthState.getToken();

    if (token) {
      try {
        await addPriceAlert(token, alertData);
        window.dispatchEvent(new CustomEvent('alerts-changed'));
        return true;
      } catch (err) {
        console.error('Failed to set alert on server:', err);
        throw err;
      }
    }

    // Guest mode
    const alerts = await this.getAlerts();
    const prodId = String(alertData.productId || alertData.id);
    const targetPrice = Number(alertData.targetPrice);

    const entry = {
      id: prodId,
      productId: prodId,
      name: alertData.name || alertData.title || 'Product',
      currentPrice: alertData.currentPrice != null ? Number(alertData.currentPrice) : null,
      targetPrice,
      store: alertData.store || 'Retailer',
      image: alertData.image || '',
      buyUrl: alertData.buyUrl || '',
      createdAt: new Date().toISOString()
    };

    const existingIdx = alerts.findIndex(a => String(a.id || a.productId) === prodId);
    if (existingIdx !== -1) {
      alerts[existingIdx] = entry;
    } else {
      alerts.unshift(entry);
    }

    localStorage.setItem(GUEST_ALERTS_KEY, JSON.stringify(alerts));
    window.dispatchEvent(new CustomEvent('alerts-changed'));
    return true;
  },

  async removeAlert(productId) {
    if (!productId) return false;
    const token = AuthState.getToken();

    if (token) {
      try {
        await removePriceAlert(token, productId);
        window.dispatchEvent(new CustomEvent('alerts-changed'));
        return true;
      } catch (err) {
        console.error('Failed to remove alert from server:', err);
      }
    }

    let alerts = await this.getAlerts();
    alerts = alerts.filter(a => String(a.id || a.productId) !== String(productId));
    localStorage.setItem(GUEST_ALERTS_KEY, JSON.stringify(alerts));
    window.dispatchEvent(new CustomEvent('alerts-changed'));
    return true;
  },

  async hasAlert(productId) {
    if (!productId) return false;
    const alerts = await this.getAlerts();
    return alerts.some(a => String(a.id || a.productId) === String(productId));
  }
};
