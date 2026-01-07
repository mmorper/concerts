import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

// Genre colors
const GENRE_COLORS = {
  'New Wave': '#1e40af',
  'Punk': '#991b1b',
  'Alternative': '#5b21b6',
  'Ska': '#f59e0b',
  'Indie Rock': '#0ea5e9',
  'Electronic': '#06b6d4',
  'Post Punk': '#be123c',
  'Other': '#6b7280',
};

// Genre data with shows broken down by year
const genreData = [
  { 
    name: 'Ska', 
    showsByYear: { 1980: 1, 1981: 1, 1983: 2, 2012: 2, 2013: 2, 2019: 3, 2022: 2, 2023: 3 },
  },
  { 
    name: 'Post Punk', 
    showsByYear: { 1983: 2, 1984: 2, 1986: 1, 2005: 1, 2008: 1, 2018: 2, 2022: 3 },
  },
  { 
    name: 'New Wave', 
    showsByYear: { 1984: 3, 1985: 4, 1986: 3, 1987: 2, 1988: 2, 1989: 3, 2001: 2, 2006: 2, 2009: 2, 2013: 2, 2017: 3, 2019: 2, 2022: 4, 2023: 4 },
  },
  { 
    name: 'Alternative', 
    showsByYear: { 1985: 2, 1986: 3, 1997: 2, 2004: 2, 2007: 2, 2008: 2, 2010: 3, 2014: 3, 2016: 2, 2023: 3 },
  },
  { 
    name: 'Punk', 
    showsByYear: { 1992: 2, 1993: 3, 1995: 4, 1996: 3, 1997: 2, 1998: 2, 1999: 1, 2003: 2, 2004: 2, 2007: 1, 2011: 1, 2014: 1, 2015: 1, 2016: 1, 2017: 1, 2019: 1, 2021: 1 },
  },
  { 
    name: 'Electronic', 
    showsByYear: { 2001: 1, 2004: 2, 2005: 2, 2012: 2, 2014: 2, 2015: 2, 2022: 3 },
  },
  { 
    name: 'Indie Rock', 
    showsByYear: { 2005: 2, 2006: 2, 2007: 3, 2010: 3, 2014: 2, 2015: 2, 2017: 1, 2019: 2, 2022: 2 },
  },
  { 
    name: 'Other', 
    showsByYear: { 1982: 1, 1984: 1, 1985: 2, 1988: 1, 1990: 2, 1991: 1, 1992: 1, 1995: 1, 1998: 1, 2000: 2, 2005: 1, 2006: 1, 2010: 2, 2012: 1, 2015: 2, 2018: 1, 2020: 1, 2023: 2 },
  },
];

const START_YEAR = 1980;
const END_YEAR = 2024;
const DECADES = [1980, 1990, 2000, 2010, 2020];

// Milestone shows
const MILESTONES = [25, 50, 75, 100, 125, 150];

// Calculate cumulative counts up to a given year
function getCumulativeCounts(year) {
  return genreData.map(genre => {
    let count = 0;
    Object.entries(genre.showsByYear).forEach(([y, c]) => {
      if (parseInt(y) <= year) count += c;
    });
    return { name: genre.name, count: Math.max(count, 0) };
  }).filter(g => g.count > 0);
}

function getTotalShows(year) {
  return getCumulativeCounts(year).reduce((sum, g) => sum + g.count, 0);
}

// Find year when milestone was reached
function getMilestoneYear(milestone) {
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    if (getTotalShows(year) >= milestone) return year;
  }
  return null;
}

// Squarified treemap
function squarify(data, x, y, width, height) {
  if (data.length === 0) return [];
  
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return [];
  
  const tiles = [];
  let remaining = [...data].sort((a, b) => b.count - a.count);
  let currentX = x;
  let currentY = y;
  let currentWidth = width;
  let currentHeight = height;

  while (remaining.length > 0) {
    const isHorizontal = currentWidth >= currentHeight;
    const side = isHorizontal ? currentHeight : currentWidth;
    
    let row = [];
    let rowSum = 0;
    let worstRatio = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const testRow = [...row, remaining[i]];
      const testSum = rowSum + remaining[i].count;
      const rowSize = (testSum / total) * (isHorizontal ? currentWidth : currentHeight);
      
      let maxRatio = 0;
      testRow.forEach(item => {
        const itemSize = (item.count / testSum) * side;
        const ratio = Math.max(rowSize / itemSize, itemSize / rowSize);
        maxRatio = Math.max(maxRatio, ratio);
      });
      
      if (maxRatio <= worstRatio || row.length === 0) {
        row = testRow;
        rowSum = testSum;
        worstRatio = maxRatio;
      } else {
        break;
      }
    }
    
    const rowSize = (rowSum / total) * (isHorizontal ? currentWidth : currentHeight);
    let offset = 0;
    
    row.forEach(item => {
      const itemSize = (item.count / rowSum) * side;
      
      if (isHorizontal) {
        tiles.push({ ...item, x: currentX + offset, y: currentY, width: itemSize, height: rowSize });
        offset += itemSize;
      } else {
        tiles.push({ ...item, x: currentX, y: currentY + offset, width: rowSize, height: itemSize });
        offset += itemSize;
      }
    });
    
    if (isHorizontal) {
      currentY += rowSize;
      currentHeight -= rowSize;
    } else {
      currentX += rowSize;
      currentWidth -= rowSize;
    }
    
    remaining = remaining.slice(row.length);
  }
  
  return tiles;
}

function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function getTextColor(bgColor) {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

function formatYears(showsByYear, upToYear) {
  const years = Object.keys(showsByYear)
    .map(Number)
    .filter(y => y <= upToYear)
    .sort((a, b) => a - b);
  
  if (years.length === 0) return '';
  if (years.length <= 3) return years.join('  ');
  return `${years[0]} → ${years[years.length - 1]}`;
}

// Haptic feedback
function triggerHaptic(style = 'light') {
  if (navigator.vibrate) {
    const patterns = {
      light: [10],
      medium: [20],
      decade: [30, 20, 30],
    };
    navigator.vibrate(patterns[style] || patterns.light);
  }
}

// Animated number component
function AnimatedNumber({ value, className }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  
  useEffect(() => {
    if (value !== prevValue.current) {
      // Quick transition
      const steps = 3;
      const diff = value - prevValue.current;
      const stepSize = diff / steps;
      let current = prevValue.current;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        current += stepSize;
        setDisplayValue(Math.round(current));
        if (step >= steps) {
          clearInterval(interval);
          setDisplayValue(value);
        }
      }, 30);
      
      prevValue.current = value;
      return () => clearInterval(interval);
    }
  }, [value]);
  
  return <span className={className}>{displayValue}</span>;
}

export default function GenreTreemapMock() {
  const [currentYear, setCurrentYear] = useState(END_YEAR);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredTile, setHoveredTile] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const sliderRef = useRef(null);
  const prevDecade = useRef(Math.floor(END_YEAR / 10) * 10);
  
  // Track previous tile positions for smooth transitions
  const [tilePositions, setTilePositions] = useState({});
  
  const containerSize = { width: 720, height: 480 };
  const padding = 4;
  
  // Calculate tiles for current year
  const rawTiles = useMemo(() => {
    const data = getCumulativeCounts(currentYear);
    return squarify(data, padding, padding, containerSize.width - padding * 2, containerSize.height - padding * 2);
  }, [currentYear]);
  
  // Update tile positions with smooth tracking
  useEffect(() => {
    const newPositions = {};
    rawTiles.forEach(tile => {
      newPositions[tile.name] = {
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        count: tile.count,
      };
    });
    setTilePositions(newPositions);
  }, [rawTiles]);
  
  const totalShows = getTotalShows(currentYear);
  
  // Find dominant genre for background color
  const dominantGenre = useMemo(() => {
    if (rawTiles.length === 0) return null;
    return rawTiles.reduce((max, tile) => tile.count > max.count ? tile : max, rawTiles[0]);
  }, [rawTiles]);
  
  const bgColor = dominantGenre ? GENRE_COLORS[dominantGenre.name] || GENRE_COLORS['Other'] : '#1e293b';
  
  // Decade change haptic
  useEffect(() => {
    const currentDecade = Math.floor(currentYear / 10) * 10;
    if (currentDecade !== prevDecade.current && hasInteracted) {
      triggerHaptic('decade');
      prevDecade.current = currentDecade;
    }
  }, [currentYear, hasInteracted]);
  
  const getYearFromPosition = useCallback((clientX) => {
    if (!sliderRef.current) return currentYear;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(START_YEAR + percent * (END_YEAR - START_YEAR));
  }, [currentYear]);
  
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setHasInteracted(true);
    setCurrentYear(getYearFromPosition(e.clientX));
    triggerHaptic('light');
  };
  
  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setCurrentYear(getYearFromPosition(e.clientX));
    }
  }, [isDragging, getYearFromPosition]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleTouchStart = (e) => {
    setIsDragging(true);
    setHasInteracted(true);
    setCurrentYear(getYearFromPosition(e.touches[0].clientX));
    triggerHaptic('light');
  };
  
  const handleTouchMove = useCallback((e) => {
    if (isDragging) {
      setCurrentYear(getYearFromPosition(e.touches[0].clientX));
    }
  }, [isDragging, getYearFromPosition]);
  
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);
  
  const timelinePercent = ((currentYear - START_YEAR) / (END_YEAR - START_YEAR)) * 100;
  
  const shouldShowContent = (tile) => tile.width >= 50 && tile.height >= 38;
  
  const getFontSize = (tile) => {
    const area = tile.width * tile.height;
    const base = Math.sqrt(area) / 6.5;
    return Math.max(9, Math.min(18, base));
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 font-sans select-none transition-colors duration-700"
      style={{
        background: `
          radial-gradient(ellipse at 50% 30%, ${bgColor}20 0%, transparent 50%),
          linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)
        `,
      }}
    >
      {/* Keyframes */}
      <style>{`
        @keyframes wobble {
          0%, 100% { transform: translateX(-50%) translateY(-50%) translateX(0); }
          25% { transform: translateX(-50%) translateY(-50%) translateX(-4px); }
          75% { transform: translateX(-50%) translateY(-50%) translateX(4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .wobble {
          animation: wobble 1.5s ease-in-out infinite;
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-3xl font-light text-white tracking-wide mb-1">The Music</h1>
        <p className="text-slate-400 text-sm">Your musical journey through time</p>
      </div>
      
      {/* Year display with animated counter */}
      <div className="mb-4 text-center">
        <div 
          className="text-7xl font-extralight text-white tabular-nums tracking-tight transition-transform duration-100"
          style={{ 
            transform: isDragging ? 'scale(1.02)' : 'scale(1)',
            textShadow: `0 0 60px ${bgColor}60`,
          }}
        >
          <AnimatedNumber value={currentYear} />
        </div>
        <div className="text-slate-400 text-sm mt-1 flex items-center justify-center gap-2">
          <AnimatedNumber value={totalShows} className="font-medium text-white" />
          <span>{totalShows === 1 ? 'show' : 'shows'} attended</span>
          {dominantGenre && (
            <>
              <span className="text-slate-600">·</span>
              <span 
                className="font-medium transition-colors duration-300"
                style={{ color: adjustBrightness(bgColor, 40) }}
              >
                {dominantGenre.name} era
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Treemap */}
      <div 
        className="relative bg-slate-950/40 backdrop-blur-sm rounded-xl overflow-hidden shadow-2xl border border-white/5"
        style={{ width: containerSize.width, height: containerSize.height }}
      >
        <svg width={containerSize.width} height={containerSize.height}>
          <defs>
            {genreData.map((genre) => {
              const baseColor = GENRE_COLORS[genre.name] || GENRE_COLORS['Other'];
              return (
                <linearGradient key={`grad-${genre.name}`} id={`grad-${genre.name.replace(/\s/g, '-')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={adjustBrightness(baseColor, 18)} />
                  <stop offset="100%" stopColor={baseColor} />
                </linearGradient>
              );
            })}
          </defs>
          
          {/* Render all possible genres, animate their positions */}
          {genreData.map((genre) => {
            const pos = tilePositions[genre.name];
            if (!pos) return null;
            
            const baseColor = GENRE_COLORS[genre.name] || GENRE_COLORS['Other'];
            const textColor = getTextColor(baseColor);
            const showContent = pos.width >= 50 && pos.height >= 38;
            const fontSize = getFontSize(pos);
            const isHovered = hoveredTile === genre.name;
            const yearsDisplay = formatYears(genre.showsByYear, currentYear);
            
            return (
              <g 
                key={genre.name}
                onMouseEnter={() => setHoveredTile(genre.name)}
                onMouseLeave={() => setHoveredTile(null)}
                style={{
                  transition: 'opacity 0.2s ease-out',
                  opacity: pos.count > 0 ? 1 : 0,
                }}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={Math.max(0, pos.width - padding)}
                  height={Math.max(0, pos.height - padding)}
                  fill={`url(#grad-${genre.name.replace(/\s/g, '-')})`}
                  rx={3}
                  ry={3}
                  stroke={isHovered ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{
                    transition: 'x 0.25s ease-out, y 0.25s ease-out, width 0.25s ease-out, height 0.25s ease-out, filter 0.15s ease',
                    filter: isHovered ? 'brightness(1.15)' : 'none',
                  }}
                />
                
                {showContent && pos.count > 0 && (
                  <foreignObject
                    x={pos.x}
                    y={pos.y}
                    width={pos.width - padding}
                    height={pos.height - padding}
                    style={{ 
                      pointerEvents: 'none',
                      transition: 'x 0.25s ease-out, y 0.25s ease-out, width 0.25s ease-out, height 0.25s ease-out',
                    }}
                  >
                    <div 
                      className="w-full h-full flex flex-col items-center justify-center text-center px-2"
                      style={{ color: textColor }}
                    >
                      <div 
                        className="font-semibold leading-tight"
                        style={{ 
                          fontSize: fontSize,
                          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                        }}
                      >
                        {genre.name}
                      </div>
                      {pos.width >= 65 && pos.height >= 50 && yearsDisplay && (
                        <div 
                          className="opacity-75 mt-0.5 font-mono"
                          style={{ fontSize: fontSize * 0.6 }}
                        >
                          {yearsDisplay}
                        </div>
                      )}
                      {pos.width >= 50 && pos.height >= 45 && (
                        <div 
                          className="opacity-70 mt-0.5"
                          style={{ fontSize: fontSize * 0.55 }}
                        >
                          {pos.count} shows
                        </div>
                      )}
                    </div>
                  </foreignObject>
                )}
              </g>
            );
          })}
          
          {/* Empty state */}
          {rawTiles.length === 0 && (
            <text
              x={containerSize.width / 2}
              y={containerSize.height / 2}
              textAnchor="middle"
              fill="#64748b"
              fontSize="16"
            >
              No shows yet...
            </text>
          )}
        </svg>
      </div>
      
      {/* Timeline slider - thinner, more refined */}
      <div className="mt-8 w-full max-w-[720px]">
        {/* Edge labels */}
        <div className="flex justify-between mb-2 px-1">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <span className="text-slate-400">←</span> 1980
          </span>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            Today <span className="text-slate-400">→</span>
          </span>
        </div>
        
        <div 
          ref={sliderRef}
          className="relative h-8 bg-slate-800/60 rounded-full cursor-grab active:cursor-grabbing overflow-visible border border-slate-700/50"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            boxShadow: isDragging 
              ? `inset 0 1px 4px rgba(0,0,0,0.3), 0 0 20px ${bgColor}30` 
              : 'inset 0 1px 4px rgba(0,0,0,0.2)',
            transition: 'box-shadow 0.3s ease',
          }}
        >
          {/* Decade markers */}
          {DECADES.map((decade) => {
            const percent = ((decade - START_YEAR) / (END_YEAR - START_YEAR)) * 100;
            return (
              <div
                key={decade}
                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${percent}%` }}
              >
                <div className="w-px h-3 bg-slate-600/60" />
              </div>
            );
          })}
          
          {/* Milestone pips */}
          {MILESTONES.map((milestone) => {
            const year = getMilestoneYear(milestone);
            if (!year) return null;
            const percent = ((year - START_YEAR) / (END_YEAR - START_YEAR)) * 100;
            return (
              <div
                key={milestone}
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-400/60"
                style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}
                title={`${milestone} shows`}
              />
            );
          })}
          
          {/* Progress fill */}
          <div 
            className="absolute top-1 bottom-1 left-1 rounded-full"
            style={{ 
              width: `calc(${timelinePercent}% - 4px)`,
              background: `linear-gradient(90deg, ${bgColor}50 0%, ${bgColor}30 100%)`,
              transition: isDragging ? 'none' : 'width 0.15s ease-out',
            }}
          />
          
          {/* Thumb */}
          <div 
            className={`absolute top-1/2 flex flex-col items-center ${!hasInteracted ? 'wobble' : ''}`}
            style={{ 
              left: `${timelinePercent}%`,
              transform: `translateX(-50%) translateY(-50%) ${isDragging ? 'scale(1.15)' : 'scale(1)'}`,
              transition: isDragging ? 'transform 0.1s ease' : 'left 0.15s ease-out, transform 0.2s ease',
            }}
          >
            {/* Thumb handle - extends above/below track */}
            <div 
              className="w-4 h-10 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(180deg, ${adjustBrightness(bgColor, 60)} 0%, ${bgColor} 50%, ${adjustBrightness(bgColor, -20)} 100%)`,
                boxShadow: isDragging 
                  ? `0 0 20px ${bgColor}80, 0 4px 12px rgba(0,0,0,0.4)` 
                  : `0 0 10px ${bgColor}40, 0 2px 8px rgba(0,0,0,0.3)`,
                border: '2px solid rgba(255,255,255,0.3)',
              }}
            >
              {/* Grip texture */}
              <div className="flex flex-col gap-0.5">
                <div className="w-1.5 h-px bg-white/40 rounded" />
                <div className="w-1.5 h-px bg-white/40 rounded" />
                <div className="w-1.5 h-px bg-white/40 rounded" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Decade labels below */}
        <div className="relative h-5 mt-1">
          {DECADES.map((decade) => {
            const percent = ((decade - START_YEAR) / (END_YEAR - START_YEAR)) * 100;
            const isActive = currentYear >= decade && currentYear < decade + 10;
            return (
              <span
                key={decade}
                className="absolute text-[10px] tabular-nums transition-all duration-200"
                style={{ 
                  left: `${percent}%`,
                  transform: 'translateX(-50%)',
                  color: isActive ? adjustBrightness(bgColor, 50) : '#64748b',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {decade}s
              </span>
            );
          })}
        </div>
      </div>
      
      {/* Narrative */}
      <div className="mt-4 text-center max-w-md h-10">
        {currentYear <= 1981 && (
          <p className="text-slate-400 text-sm animate-fadeIn">
            <span className="text-amber-400 font-medium">1980</span> — It begins with <span className="text-amber-400">Ska</span>.
          </p>
        )}
        {currentYear > 1981 && currentYear < 1990 && (
          <p className="text-slate-400 text-sm">
            <span style={{ color: adjustBrightness(bgColor, 50) }} className="font-medium">The 80s</span> — New Wave and Post Punk define your sound.
          </p>
        )}
        {currentYear >= 1990 && currentYear < 2000 && (
          <p className="text-slate-400 text-sm">
            <span style={{ color: adjustBrightness(bgColor, 50) }} className="font-medium">The 90s</span> — Punk takes over.
          </p>
        )}
        {currentYear >= 2000 && currentYear < 2010 && (
          <p className="text-slate-400 text-sm">
            <span style={{ color: adjustBrightness(bgColor, 50) }} className="font-medium">The 2000s</span> — Electronic and Indie Rock arrive.
          </p>
        )}
        {currentYear >= 2010 && currentYear < 2020 && (
          <p className="text-slate-400 text-sm">
            <span style={{ color: adjustBrightness(bgColor, 50) }} className="font-medium">The 2010s</span> — A decade of musical diversity.
          </p>
        )}
        {currentYear >= 2020 && (
          <p className="text-slate-400 text-sm">
            <span className="text-white font-medium">Now</span> — {totalShows} shows across {Object.keys(tilePositions).filter(k => tilePositions[k]?.count > 0).length} genres.
          </p>
        )}
      </div>
    </div>
  );
}
