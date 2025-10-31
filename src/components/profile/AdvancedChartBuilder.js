'use client';

import { useState, useEffect } from 'react';
import styles from '@/styles/advancedChart.module.css';

export default function AdvancedChartBuilder({ stats, chartData, config: initialConfig, readOnly = false }) {
  const [config, setConfig] = useState(initialConfig || {
    chartType: 'bar',
    dataSource: 'status',
  });

  // Update config when initialConfig changes (for real-time preview)
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  // Prepare data based on dataSource
  let data = [];
  if (config.dataSource === 'status') {
    data = [
      { label: 'Success', value: stats.successCount, color: 'hsl(142, 71%, 45%)' },
      { label: 'Loss', value: stats.lossCount, color: 'hsl(0, 84%, 60%)' },
      { label: 'Open', value: stats.openCount, color: 'hsl(217, 91%, 60%)' },
    ];
  } else if (config.dataSource === 'sentiment') {
    data = [
      { label: 'Bullish', value: chartData.sentimentData?.bullish?.total || 0, color: 'hsl(142, 71%, 45%)' },
      { label: 'Bearish', value: chartData.sentimentData?.bearish?.total || 0, color: 'hsl(0, 84%, 60%)' },
      { label: 'Neutral', value: chartData.sentimentData?.neutral?.total || 0, color: 'hsl(214, 6%, 45%)' },
    ];
  } else if (config.dataSource === 'strategy') {
    const strategies = Object.entries(chartData.strategyData || {})
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    data = strategies.map(([name, d], i) => ({
      label: name,
      value: d.total,
      color: `hsl(${i * 72}, 70%, 60%)`,
    }));
  } else if (config.dataSource === 'country') {
    const countries = Object.entries(chartData.countryData || {})
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
    data = countries.map(([name, d], i) => ({
      label: name,
      value: d.total,
      color: `hsl(${i * 60}, 65%, 55%)`,
    }));
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={styles.builderContainer}>
      {/* Form - Only show if not readOnly */}
      {!readOnly && (
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label>Chart Type</label>
          <select value={config.chartType} onChange={(e) => setConfig({...config, chartType: e.target.value})}>
            <option value="bar">📊 Bar</option>
            <option value="horizontalBar">📊 Horizontal Bar</option>
            <option value="line">📈 Line</option>
            <option value="area">📈 Area</option>
            <option value="pie">🥧 Pie</option>
            <option value="donut">🍩 Donut</option>
            <option value="radar">🕸️ Radar</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label>Data Source</label>
          <select value={config.dataSource} onChange={(e) => setConfig({...config, dataSource: e.target.value})}>
            <option value="status">📊 Post Status</option>
            <option value="sentiment">💭 Sentiment</option>
            <option value="strategy">🎯 Strategy</option>
            <option value="country">🌍 Country</option>
          </select>
        </div>
      </div>
      )}

      {/* Chart Rendering */}
      <div className={styles.chartArea}>
        {data.length === 0 ? (
          <div className={styles.noData}>No data available</div>
        ) : config.chartType === 'bar' ? (
          <div className={styles.barChart}>
            {data.map((item, i) => (
              <div key={i} className={styles.barItem}>
                <div className={styles.bar} style={{ height: `${(item.value/maxValue)*100}%`, background: item.color }}>
                  <span className={styles.barValueLabel}>{item.value}</span>
                </div>
                <div className={styles.label}>{item.label}</div>
              </div>
            ))}
          </div>
        ) : config.chartType === 'horizontalBar' ? (
          <div className={styles.horizontalBarChart}>
            {data.map((item, i) => (
              <div key={i} className={styles.hBarRow}>
                <div className={styles.hBarLabel}>{item.label}</div>
                <div className={styles.hBarTrack}>
                  <div className={styles.hBar} style={{ width: `${(item.value/maxValue)*100}%`, background: item.color }}>
                    <span className={styles.hBarValue}>{item.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : config.chartType === 'line' ? (
          <svg viewBox="0 0 400 250" className={styles.svgChart}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(y => (
              <line key={y} x1="40" y1={200 - y * 1.5} x2="380" y2={200 - y * 1.5} stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
            ))}
            {/* Line */}
            <polyline
              fill="none"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth="3"
              points={data.map((d, i) => {
                const x = 40 + (i / (data.length - 1 || 1)) * 340;
                const y = 200 - (d.value / maxValue) * 150;
                return `${x},${y}`;
              }).join(' ')}
            />
            {/* Points */}
            {data.map((d, i) => {
              const x = 40 + (i / (data.length - 1 || 1)) * 340;
              const y = 200 - (d.value / maxValue) * 150;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="5" fill={d.color} stroke="white" strokeWidth="2" />
                  <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="hsl(var(--foreground))">
                    {d.value}
                  </text>
                  <text x={x} y={220} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : config.chartType === 'area' ? (
          <svg viewBox="0 0 400 250" className={styles.svgChart}>
            {[0, 25, 50, 75, 100].map(y => (
              <line key={y} x1="40" y1={200 - y * 1.5} x2="380" y2={200 - y * 1.5} stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
            ))}
            <polygon
              fill="rgba(76, 175, 80, 0.2)"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth="3"
              points={data.map((d, i) => {
                const x = 40 + (i / (data.length - 1 || 1)) * 340;
                const y = 200 - (d.value / maxValue) * 150;
                return `${x},${y}`;
              }).join(' ') + ' 380,200 40,200'}
            />
            {data.map((d, i) => {
              const x = 40 + (i / (data.length - 1 || 1)) * 340;
              const y = 200 - (d.value / maxValue) * 150;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="5" fill={d.color} stroke="white" strokeWidth="2" />
                  <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="hsl(var(--foreground))">{d.value}</text>
                </g>
              );
            })}
          </svg>
        ) : config.chartType === 'pie' || config.chartType === 'donut' ? (
          <div className={styles.pieContainer}>
            <svg viewBox="0 0 200 200" className={styles.svgChart}>
              {(() => {
                let currentAngle = -90;
                const cx = 100;
                const cy = 100;
                const outerRadius = 80;
                const innerRadius = config.chartType === 'donut' ? 50 : 0;
                
                return data.map((item, i) => {
                  if (item.value === 0) return null;
                  const percentage = (item.value / total) * 100;
                  const angle = (percentage / 100) * 360;
                  const startAngle = currentAngle;
                  const endAngle = currentAngle + angle;
                  
                  const x1o = cx + outerRadius * Math.cos((startAngle * Math.PI) / 180);
                  const y1o = cy + outerRadius * Math.sin((startAngle * Math.PI) / 180);
                  const x2o = cx + outerRadius * Math.cos((endAngle * Math.PI) / 180);
                  const y2o = cy + outerRadius * Math.sin((endAngle * Math.PI) / 180);
                  
                  const x1i = cx + innerRadius * Math.cos((startAngle * Math.PI) / 180);
                  const y1i = cy + innerRadius * Math.sin((startAngle * Math.PI) / 180);
                  const x2i = cx + innerRadius * Math.cos((endAngle * Math.PI) / 180);
                  const y2i = cy + innerRadius * Math.sin((endAngle * Math.PI) / 180);
                  
                  const largeArc = angle > 180 ? 1 : 0;
                  
                  let path;
                  if (config.chartType === 'donut') {
                    path = `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x1i} ${y1i} Z`;
                  } else {
                    path = `M ${cx} ${cy} L ${x1o} ${y1o} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2o} ${y2o} Z`;
                  }
                  
                  currentAngle = endAngle;
                  
                  const labelRadius = config.chartType === 'donut' ? (innerRadius + outerRadius) / 2 : outerRadius * 0.65;
                  const labelX = cx + labelRadius * Math.cos(((startAngle + endAngle) / 2 * Math.PI) / 180);
                  const labelY = cy + labelRadius * Math.sin(((startAngle + endAngle) / 2 * Math.PI) / 180);
                  
                  return (
                    <g key={i}>
                      <path d={path} fill={item.color} stroke="white" strokeWidth="2" opacity="0.9" />
                      <text x={labelX} y={labelY} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">
                        {percentage.toFixed(0)}%
                      </text>
                    </g>
                  );
                });
              })()}
            </svg>
            <div className={styles.pieLegend}>
              {data.map((item, i) => (
                <div key={i} className={styles.legendItem}>
                  <div className={styles.legendDot} style={{ background: item.color }}></div>
                  <span>{item.label}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : config.chartType === 'radar' ? (
          <svg viewBox="0 0 300 300" className={styles.svgChart}>
            {(() => {
              const cx = 150;
              const cy = 150;
              const numPoints = data.length;
              const angleStep = (2 * Math.PI) / numPoints;
              const maxRadius = 120;
              
              // Draw background circles
              return (
                <>
                  {[25, 50, 75, 100].map((percent) => (
                    <circle 
                      key={percent} 
                      cx={cx} 
                      cy={cy} 
                      r={(maxRadius * percent) / 100} 
                      fill="none" 
                      stroke="hsl(var(--border))" 
                      strokeWidth="1" 
                      opacity="0.3"
                    />
                  ))}
                  
                  {/* Draw axes */}
                  {data.map((d, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const x = cx + maxRadius * Math.cos(angle);
                    const y = cy + maxRadius * Math.sin(angle);
                    return (
                      <g key={i}>
                        <line x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
                        <text 
                          x={cx + (maxRadius + 20) * Math.cos(angle)} 
                          y={cy + (maxRadius + 20) * Math.sin(angle)} 
                          textAnchor="middle" 
                          fontSize="11" 
                          fontWeight="600"
                          fill="hsl(var(--foreground))"
                        >
                          {d.label}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Draw data polygon */}
                  <polygon
                    points={data.map((d, i) => {
                      const angle = i * angleStep - Math.PI / 2;
                      const radius = (d.value / maxValue) * maxRadius;
                      const x = cx + radius * Math.cos(angle);
                      const y = cy + radius * Math.sin(angle);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="hsl(142, 71%, 45%, 0.3)"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth="2"
                  />
                  
                  {/* Draw data points */}
                  {data.map((d, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const radius = (d.value / maxValue) * maxRadius;
                    const x = cx + radius * Math.cos(angle);
                    const y = cy + radius * Math.sin(angle);
                    return (
                      <circle key={i} cx={x} cy={y} r="4" fill={d.color} stroke="white" strokeWidth="2" />
                    );
                  })}
                </>
              );
            })()}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
