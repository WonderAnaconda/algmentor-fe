import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileUpload } from '@/components/ui/file-upload';
import { TradingDashboard } from '@/components/TradingDashboard';
import { AnalysisResults } from '@/components/AnalysisResults';
import { SmartPageBreakPDF } from '@/components/SmartPageBreakPDF';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, TrendingUp, Upload, AlertCircle, Menu } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthStatus from '@/components/AuthStatus';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { useRef } from 'react';
import tradeAnalysisPy from '../../python/trade_analysis_daily.py?raw';
import atasLogo from '/atas_logo.png';
import tradingViewLogo from '/tradingview.png';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { ClusterAnalysis } from '@/components/ClusterAnalysis';
import WeekdayAnalysis from '@/components/WeekdayAnalysis';
import Navbar from '@/components/Navbar';
import { AnalysisDock } from '@/components/AnalysisDock';
import { GradientBanner } from '@/components/GradientBanner';

// Mock data for demonstration
const mockMetrics = {
  totalTrades: 247,
  winRate: 64.2,
  profitLoss: 15750,
  avgWin: 235,
  avgLoss: 156,
  maxDrawdown: 8.3,
  sharpeRatio: 1.47
};

const mockSuggestions = [
  {
    id: '1',
    type: 'risk' as const,
    title: 'High Position Sizing on Low Probability Trades',
    description: 'You tend to risk 3-5% on trades with win rates below 45%. Consider reducing position size to 1-2% for these setups.',
    impact: 'high' as const,
    category: 'Risk Management'
  },
  {
    id: '2',
    type: 'opportunity' as const,
    title: 'Underutilized Momentum Breakouts',
    description: 'Your momentum breakout strategy shows 78% win rate but only represents 12% of your trades. Consider increasing allocation.',
    impact: 'medium' as const,
    category: 'Strategy Allocation'
  },
  {
    id: '3',
    type: 'strategy' as const,
    title: 'Exit Strategy Optimization',
    description: 'Analysis shows you could improve returns by 23% using trailing stops instead of fixed targets on trending trades.',
    impact: 'high' as const,
    category: 'Exit Strategy'
  }
];

// Utility: deeply convert Maps to plain JS objects
function mapToObject(obj: any): any {
  if (obj instanceof Map) {
    const out: any = {};
    for (const [key, value] of obj.entries()) {
      out[key] = mapToObject(value);
    }
    return out;
  } else if (Array.isArray(obj)) {
    return obj.map(mapToObject);
  }
  return obj;
}

// @ts-ignore
declare global { interface Window { loadPyodide: any } }

export default function Dashboard() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const pyodideRef = useRef<any>(null);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Create refs for PDF export and section navigation
  const analysisResultsRef = useRef<HTMLDivElement>(null);
  const clusterAnalysisRef = useRef<HTMLDivElement>(null);
  const weekdayAnalysisRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>('analysis');

  // Scroll listener to update active section
  useEffect(() => {
    if (!showResults || !analysisResult) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100; // Offset for better detection
      
      const sections = [
        { id: 'analysis', ref: analysisResultsRef },
        { id: 'clusters', ref: clusterAnalysisRef },
        { id: 'weekday', ref: weekdayAnalysisRef }
      ].filter(section => {
        // Only include sections that exist
        switch (section.id) {
          case 'analysis':
            return !!analysisResult.recommendations;
          case 'clusters':
            return !!analysisResult.clusters;
          case 'weekday':
            return !!analysisResult.data?.by_weekday;
          default:
            return false;
        }
      });

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const element = section.ref.current;
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showResults, analysisResult]);

  // Preload Pyodide and packages on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // @ts-ignore
      if (!window.loadPyodide) return; // Pyodide script not loaded yet
      if (!pyodideRef.current) {
        const pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
        await pyodide.loadPackage(['pandas', 'numpy', 'scipy', 'scikit-learn']);
        await pyodide.runPythonAsync(tradeAnalysisPy);
        if (!cancelled) {
          pyodideRef.current = pyodide;
          setPyodideReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // When Pyodide becomes ready and there's a pending file, process it
  useEffect(() => {
    if (pyodideReady && pendingFile) {
      actuallyHandleFileUpload(pendingFile);
      setPendingFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pyodideReady, pendingFile]);

  // --- AUTH CHECK ---
  useEffect(() => {
    // Bypass auth if VITE_DEBUG is true
    const debug = import.meta.env.VITE_DEBUG === 'true';
    if (debug) {
      setAuthChecked(true);
      return;
    }
    let isMounted = true;
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (isMounted && !data.user) {
        // Wait a bit and try again (for OAuth redirect)
        setTimeout(async () => {
          const { data } = await supabase.auth.getUser();
          if (isMounted && !data.user) {
            setAuthChecked(true);
            navigate('/login', { replace: true });
          } else {
            setAuthChecked(true);
          }
        }, 500);
      } else {
        setAuthChecked(true);
      }
    };
    checkUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted && !session) {
        setAuthChecked(true);
        navigate('/login', { replace: true });
      } else if (isMounted && session) {
        setAuthChecked(true);
      }
    });
    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);
  // --- END AUTH CHECK ---



  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Checking authentication...</div>
      </div>
    );
  }

  // Main upload handler: always start progress, queue or process file
  const handleFileUpload = (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setHasUploadedFile(true);
    setAnalysisError(null);
    setAnalysisData(null);
    setUploadProgress(10);
    if (!pyodideReady) {
      setPendingFile(file);
      // Progress bar will show, analysis will start when ready
      return;
    }
    actuallyHandleFileUpload(file);
  };

  // Actual analysis logic, only called when Pyodide is ready
  const actuallyHandleFileUpload = async (file: File) => {
    try {
      setUploadProgress(30);
      let csvText = '';
      const fileName = file.name.toLowerCase();
      let broker = 'atas';
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = 'Journal';
        if (!workbook.Sheets[sheetName]) {
          throw new Error(`Sheet 'Journal' not found in Excel file.`);
        }
        csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        // Log the CSV string for debugging
        // console.log('FE CSV sent to Pyodide (first 1000 chars):', csvText.slice(0, 1000));
      } 
      else {
        throw new Error('Only ATAS .xlsx or .xls files are supported right now. Please upload a valid Excel file.');
        // csvText = await file.text();
        // broker = 'tradingview';
      }

      setUploadProgress(60);
      pyodideRef.current.globals.set('csv_text', csvText);
      pyodideRef.current.globals.set('broker', broker);
      await pyodideRef.current.runPythonAsync('result = process_uploaded_file(csv_text, broker)');
      const result = pyodideRef.current.globals.get('result').toJs();
      const plainResult = mapToObject(result);
      const jsonResult = JSON.parse(JSON.stringify(plainResult));
      console.log('Pyodide analysis result:', plainResult);
      setUploadProgress(90);
      setAnalysisResult(jsonResult); // Store the full result
      setAnalysisData(jsonResult.recommendations); // For backward compatibility
      setShowResults(true);
      setUploadProgress(100);
      toast({
        title: "Analysis Complete!",
        description: "File analyzed locally with Pyodide.",
      });
    } catch (error: any) {
      console.error('Analysis error:', error);
      setAnalysisError(error.message || 'Failed to analyze trading data');
      toast({
        title: "Analysis Failed",
        description: error.message || 'Failed to analyze trading data',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = () => {
    navigate('/');
  };

  const handleSectionSelect = (sectionId: string) => {
    setActiveSection(sectionId);
    let targetRef: React.RefObject<HTMLDivElement> | null = null;
    
    switch (sectionId) {
      case 'analysis':
        targetRef = analysisResultsRef;
        break;
      case 'clusters':
        targetRef = clusterAnalysisRef;
        break;
      case 'weekday':
        targetRef = weekdayAnalysisRef;
        break;
    }
    
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Main Content */}
      <main className="container mx-auto px-14 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          {!showResults && (
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-primary">
                Trading Performance Analysis
              </h2>
                              <p className="text-muted-foreground max-w-2xl mx-auto">
                Upload your trading records to get detailed performance analysis and AI-powered improvement suggestions
                <span className="ml-2">
                  <a 
                    href="https://help.atas.net/en/support/solutions/articles/72000602476-trading-statistics" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 underline transition-colors"
                  >
                    Need help? Learn how to export your trading statistics →
                  </a>
                </span>
              </p>
                
                {/* Supported Brokers Section */}
                {/* <div className="mt-8">
                  <h3 className="text-lg font-semibold text-muted-foreground mb-4">
                    Supported Brokers
                  </h3>
                  <div className="flex items-center justify-center space-x-6">
                    <div className="flex flex-col items-center space-y-2">
                      <img 
                        src={atasLogo} 
                        alt="ATAS Trading Platform" 
                        className="h-24 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                        onError={(e) => {
                          // Fallback to text if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'h-24 w-auto bg-muted/20 rounded-lg flex items-center justify-center px-4';
                            fallback.innerHTML = '<span class="text-base font-semibold text-primary">ATAS</span>';
                            parent.insertBefore(fallback, target);
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-col items-center space-y-2">
                      <img 
                        src={tradingViewLogo} 
                        alt="TradingView Platform" 
                        className="h-24 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
                        onError={(e) => {
                          // Fallback to text if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'h-24 w-auto bg-muted/20 rounded-lg flex items-center justify-center px-4';
                            fallback.innerHTML = '<span class="text-base font-semibold text-primary">TradingView</span>';
                            parent.insertBefore(fallback, target);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div> */}
              </div>
            )}

          {/* Upload Section */}
          {!showResults && (
            <Card className="max-w-2xl mx-auto bg-gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Upload Trading Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileUpload={handleFileUpload}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                />
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {analysisError && (
            <Card className="max-w-2xl mx-auto bg-gradient-card shadow-card border-loss/20">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-loss/10 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle className="h-8 w-8 text-loss" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-loss mb-2">Analysis Failed</h3>
                    <p className="text-muted-foreground">{analysisError}</p>
                  </div>
                  <Button 
                    onClick={() => {
                      setAnalysisError(null);
                      setHasUploadedFile(false);
                      setShowResults(false);
                    }}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showResults && analysisResult && analysisResult.recommendations && analysisResult.data && (
            <>
              <GradientBanner className="py-8">
                <div className="container mx-auto">
                  <Card className="bg-card/90 shadow-glow/10 p-6 md:p-8 max-w-4xl mx-auto">
                    <div className="text-center space-y-4">
                      <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent leading-tight pb-1">
                        Analysis Results
                      </h2>
                      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Performance metrics and personalized recommendations based on your trading patterns.
                      </p>
                    </div>
                  </Card>
                </div>
              </GradientBanner>
              
              <div ref={analysisResultsRef}>
                <AnalysisResults
                  analysis={analysisResult.recommendations}
                  plotData={analysisResult.data}
                  onReset={() => {
                    setHasUploadedFile(false);
                    setAnalysisError(null);
                    setAnalysisData(null);
                    setAnalysisResult(null);
                    setShowResults(false);
                    setUploadProgress(0);
                  }}
                />
              </div>
              
              {/* Cluster Analysis Section */}
              {analysisResult.clusters && (
                <div ref={clusterAnalysisRef}>
                  <GradientBanner className="py-8 mt-20">
                    <div className="container mx-auto">
                      <Card className="bg-card/90 shadow-glow/10 p-6 md:p-8 max-w-4xl mx-auto">
                        <div className="text-center space-y-4">
                          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent leading-tight pb-1">
                            Cluster Analysis
                          </h2>
                          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            AI-powered clustering of your trading patterns to identify distinct behavioral groups.
                          </p>
                        </div>
                      </Card>
                    </div>
                  </GradientBanner>
                  <ClusterAnalysis
                    clusters={analysisResult.clusters.data}
                    interpretations={analysisResult.clusters.interpretation}
                  />
                </div>
              )}
              
              {/* Weekday Analysis Section */}
              {analysisResult.data?.by_weekday && (
                <div ref={weekdayAnalysisRef}>
                  <GradientBanner className="py-8 mt-20">
                    <div className="container mx-auto">
                      <Card className="bg-card/90 shadow-glow/10 p-6 md:p-8 max-w-4xl mx-auto">
                        <div className="text-center space-y-4">
                          <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent leading-tight pb-1">
                            Weekday Analysis
                          </h2>
                          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            Day-of-week performance patterns and optimal trading timing insights.
                          </p>
                        </div>
                      </Card>
                    </div>
                  </GradientBanner>
                  <WeekdayAnalysis byWeekday={analysisResult.data.by_weekday} />
                </div>
              )}
              
              {/* Export to PDF Button */}
              <div className="flex justify-center mt-8">
                <SmartPageBreakPDF
                  elementRef={analysisResultsRef}
                  filename={`trading-analysis-${new Date().toISOString().split('T')[0]}.pdf`}
                  title="Export to PDF"
                  hasCharts={true}
                />
              </div>
              
              {/* Action buttons */}
              <div className="flex justify-center gap-4 mt-4">
                {/* Debug: Download JSON button */}
                {import.meta.env.VITE_DEBUG === 'true' && (
                  <button
                    className="bg-primary text-white px-4 py-2 rounded shadow hover:bg-primary/80 transition"
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(analysisResult, null, 2));
                      const dlAnchor = document.createElement('a');
                      dlAnchor.setAttribute("href", dataStr);
                      dlAnchor.setAttribute("download", "analysis_result.json");
                      document.body.appendChild(dlAnchor);
                      dlAnchor.click();
                      document.body.removeChild(dlAnchor);
                    }}
                  >
                    Download Raw JSON
                  </button>
                )}
              </div>
              
              {/* Analysis Dock */}
              <AnalysisDock
                onSectionSelect={handleSectionSelect}
                activeSection={activeSection}
                hasAnalysisResults={!!analysisResult.recommendations}
                hasClusterResults={!!analysisResult.clusters}
                hasWeekdayResults={!!analysisResult.data?.by_weekday}
              />
            </>
          )}

          {hasUploadedFile && !showResults && !analysisError && (
            <TradingDashboard
              metrics={undefined}
              suggestions={undefined}
              isLoading={isUploading}
            />
          )}

          {/* Info Section */}
          {!hasUploadedFile && (
            <div className="max-w-4xl mx-auto">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-gradient-card shadow-card">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Easy Upload</h3>
                    <p className="text-sm text-muted-foreground">
                      Support for CSV and Excel formats from all major brokers
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card shadow-card">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-profit/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="h-6 w-6 text-profit" />
                    </div>
                    <h3 className="font-semibold mb-2">AI Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Advanced algorithms analyze your trading patterns and performance
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card shadow-card">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Actionable Insights</h3>
                    <p className="text-sm text-muted-foreground">
                      Get specific recommendations to improve your trading performance
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}