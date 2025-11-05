'use client';

import { useState, useEffect } from 'react';
import { usePremiumPlan } from '@/providers/PremiumPlanProvider';
import PayPalConnect from '@/components/paypal/PayPalConnect';

export default function PremiumPlanTab() {
  const { planData, loading, saving, error, savePremiumPlan, addFeature, removeFeature } = usePremiumPlan();
  const [formData, setFormData] = useState({ description: '', pricing: { monthly: 0, yearly: 0, currency: 'USD' }, features: [] });
  const [newFeature, setNewFeature] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (planData) setFormData(planData);
  }, [planData]);

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    setFormData(prev => ({ ...prev, features: [...prev.features, newFeature.trim()] }));
    setNewFeature('');
  };

  const handleRemoveFeature = (index) => {
    setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }));
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '60px', height: '60px', border: '6px solid hsl(var(--muted))', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }}></div>
        <p style={{ fontSize: '18px', color: 'hsl(var(--muted-foreground))' }}>Loading Premium Broker Plan...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted)) 100%)', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'grid', gap: '2rem' }}>
        
        {/* Modern Header with Stats */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '24px', padding: 'clamp(2rem, 4vw, 4rem)', color: 'white', boxShadow: '0 20px 60px rgba(102, 126, 234, 0.3)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)', borderRadius: '50%' }}></div>
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: '900', margin: 0, marginBottom: '1rem' }}>⭐ Premium Broker Plan</h1>
              <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', opacity: 0.9, margin: 0, lineHeight: 1.6 }}>Monetize your trading expertise with premium subscriptions</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '16px', padding: '1.5rem', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{planData?.stats?.totalSubscribers || 0}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>Subscribers</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '16px', padding: '1.5rem', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{planData?.stats?.successRate || 0}%</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.5rem' }}>Success Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          {/* PayPal */}
          <PayPalConnect />
          
          {/* Plan Description */}
          <div style={{ background: 'hsl(var(--card))', borderRadius: '20px', padding: '2rem', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>📝 Plan Description</h3>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{ width: '100%', minHeight: '120px', padding: '1rem', borderRadius: '12px', border: '2px solid hsl(var(--border))', fontSize: '15px', fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Describe your premium plan benefits..."
            />
          </div>
        </div>

        {/* Three Column Layout for Pricing and Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
          
          {/* Pricing */}
          <div style={{ background: 'hsl(var(--card))', borderRadius: '20px', padding: '2rem', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>💰 Pricing</h3>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '14px' }}>Monthly Price</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={formData.pricing.monthly}
                    onChange={(e) => setFormData({ ...formData, pricing: { ...formData.pricing, monthly: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '2px solid hsl(var(--border))', fontSize: '16px' }}
                  />
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }}>$</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '14px' }}>Yearly Price</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={formData.pricing.yearly}
                    onChange={(e) => setFormData({ ...formData, pricing: { ...formData.pricing, yearly: parseFloat(e.target.value) || 0 } })}
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '2px solid hsl(var(--border))', fontSize: '16px' }}
                  />
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--muted-foreground))' }}>$</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div style={{ background: 'hsl(var(--card))', borderRadius: '20px', padding: '2rem', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', gridColumn: 'span 2' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>✨ Features</h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                placeholder="Add a new feature..."
                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '12px', border: '2px solid hsl(var(--border))', fontSize: '15px' }}
              />
              <button onClick={handleAddFeature} style={{ padding: '0.75rem 1.5rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>
                + Add
              </button>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}>
              {formData.features?.map((feature, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'hsl(var(--muted))', borderRadius: '12px' }}>
                  <span style={{ flex: 1 }}>✓ {feature}</span>
                  <button onClick={() => handleRemoveFeature(index)} style={{ padding: '0.5rem 0.75rem', background: 'hsl(var(--destructive))', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
          <button 
            onClick={() => savePremiumPlan(formData)} 
            disabled={saving}
            style={{ 
              padding: '1.25rem 4rem', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '16px', 
              cursor: saving ? 'not-allowed' : 'pointer', 
              fontSize: '18px', 
              fontWeight: '700',
              boxShadow: '0 10px 30px rgba(102, 126, 234, 0.4)',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? '💾 Saving...' : '💾 Save Premium Plan'}
          </button>
        </div>

        {/* Success/Error Message */}
        {message.text && (
          <div style={{ 
            padding: '1rem 2rem', 
            background: message.type === 'success' ? '#d1fae5' : '#fee2e2', 
            color: message.type === 'success' ? '#065f46' : '#991b1b', 
            borderRadius: '12px', 
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
