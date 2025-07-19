import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileUpload } from '@/components/ui/file-upload';
import { TradingDashboard } from '@/components/TradingDashboard';
import { AnalysisResults } from '@/components/AnalysisResults';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, TrendingUp, Upload, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthStatus from '@/components/AuthStatus';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { useRef } from 'react';
import tradeAnalysisPy from '../../trade_analysis_daily.py?raw';

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

  // Preload Pyodide and packages on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // @ts-ignore
      if (!window.loadPyodide) return; // Pyodide script not loaded yet
      if (!pyodideRef.current) {
        const pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
        await pyodide.loadPackage(['pandas', 'numpy', 'scipy']);
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
      setUploadProgress(10);
      // Extract Journal sheet as CSV in the browser
      let csvText = '';
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = 'Journal';
        if (!workbook.Sheets[sheetName]) {
          throw new Error(`Sheet 'Journal' not found in Excel file.`);
        }
        csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      } else {
        csvText = await file.text();
      }
      setUploadProgress(30);

      setUploadProgress(60);
      pyodideRef.current.globals.set('csv_text', csvText);
      const pythonCode = `\
import pandas as pd\nimport io\ndf = pd.read_csv(io.StringIO(csv_text))\nfor col in ['Open time', 'Close time']:\n    if col in df.columns:\n        df[col] = pd.to_datetime(df[col], errors='coerce')\nresult = analyse_trading_journal_df(df)\n`;
      await pyodideRef.current.runPythonAsync(pythonCode);
      const result = pyodideRef.current.globals.get('result').toJs();
      const plainResult = mapToObject(result);

      // Deeply convert to plain JSON object (handles any leftover non-plain objects)
      const jsonResult = JSON.parse(JSON.stringify(plainResult));
      console.log('Pyodide analysis result:', plainResult);
      setUploadProgress(90);

      setAnalysisData(jsonResult.recommendations);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="p-2 rounded-lg bg-gradient-primary">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AlgMentor</h1>
                <p className="text-xs text-muted-foreground">Trading Performance Dashboard</p>
              </div>
            </Link>
            {/* Remove the middle Logout button, keep only AuthStatus */}
            <AuthStatus />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          {!showResults && (
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-primary">
                Trading Performance Analysis
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Upload your trading records to get detailed performance analysis and AI-powered improvement suggestions
              </p>
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

          {showResults && analysisData && (
            <AnalysisResults
              analysis={analysisData}
              onReset={() => {
                setHasUploadedFile(false);
                setAnalysisError(null);
                setAnalysisData(null);
                setShowResults(false);
                setUploadProgress(0);
              }}
            />
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