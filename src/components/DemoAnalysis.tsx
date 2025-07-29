import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  TrendingDown, 
  BarChart3, 
  Calendar, 
  Target, 
  Award, 
  Volume2,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { AnalysisResults } from './AnalysisResults';
import { SmartPageBreakPDF } from './SmartPageBreakPDF';
import { ClusterAnalysis } from './ClusterAnalysis';
import WeekdayAnalysis from './WeekdayAnalysis';
import SessionAssistantAnalysis from './SessionAssistantAnalysis';
import { AnalysisDock } from './AnalysisDock';
import { GradientBanner } from './GradientBanner';
import latestDemoOutput from '../../latest_demo_output.json';
import { AnalysisData } from '@/types/analysis';


const getConfidenceColor = (confidence: string) => {
  if (confidence.toLowerCase().includes('high')) {
    return 'bg-profit/20 text-profit-foreground border-profit/30';
  } else if (confidence.toLowerCase().includes('medium')) {
    return 'bg-primary/20 text-primary-foreground !text-white border-primary/30'; // Force white text
  } else {
    return 'bg-muted/20 text-muted-foreground border-muted/30';
  }
};

export function DemoAnalysis() {
  // Use recommendations or analysis from latest_demo_output.json
  const output = latestDemoOutput as unknown as Record<string, unknown>;
  const analysis = (output.recommendations ?? output.analysis ?? output.data) as AnalysisData;
  const plotData = (output.data ?? {}) as Record<string, unknown>;
  const clusters = output.clusters as any;
  const byWeekday = (output.data as any)?.by_weekday;
  const sessionAssistant = (output.data as any)?.session_assistant;
  
  // Create refs for PDF export and section navigation
  const analysisResultsRef = useRef<HTMLDivElement>(null);
  const clusterAnalysisRef = useRef<HTMLDivElement>(null);
  const weekdayAnalysisRef = useRef<HTMLDivElement>(null);
  const sessionAssistantRef = useRef<HTMLDivElement>(null);
  const allAnalysisRef = useRef<HTMLDivElement>(null);
  
  // State for section navigation
  const [activeSection, setActiveSection] = useState<string>('analysis');
  const [isExportPDF, setIsExportPDF] = useState(false);

  const handleSectionSelect = (sectionId: string) => {
    setActiveSection(sectionId);
    const refs: { [key: string]: React.RefObject<HTMLDivElement> } = {
      'analysis': analysisResultsRef,
      'clusters': clusterAnalysisRef,
      'weekday': weekdayAnalysisRef,
      'session-assistant': sessionAssistantRef
    };
    
    const targetRef = refs[sectionId];
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };
  
  return (
    <div className="space-y-8">
      {/* Analysis Results Section */}
      <div ref={allAnalysisRef}>
        <GradientBanner className="py-8 mb-12" isExport={isExportPDF}>
          <div className="container mx-auto">
            <Card className="bg-card/90 shadow-glow/10 p-6 md:p-8 max-w-4xl mx-auto">
              <div className="text-center space-y-4">
                <h2 className={
                  `text-3xl md:text-4xl font-bold leading-tight pb-1 ` +
                  (isExportPDF
                    ? 'text-primary'
                    : 'bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent')
                }>
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
          <AnalysisResults analysis={analysis} plotData={plotData} analysisResult={output} />
        </div>
        
        {/* Cluster Analysis Section */}
        {clusters && (
          <div ref={clusterAnalysisRef}>
            <GradientBanner className="py-8 mt-20" isExport={isExportPDF}>
              <div className="container mx-auto">
                <Card className="bg-card/90 shadow-glow/10 p-6 md:p-8 max-w-4xl mx-auto">
                  <div className="text-center space-y-4">
                    <h2 className={
                      `text-3xl md:text-4xl font-bold leading-tight pb-1 ` +
                      (isExportPDF
                        ? 'text-primary'
                        : 'bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent')
                    }>
                      Cluster Analysis
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      This groups your past trades into patterns based on shared traits—like timing, size, or outcome—so you can quickly spot what's working and what's not. Use it to double down on your strongest setups and avoid repeating your weaker ones.
                    </p>
                  </div>
                </Card>
              </div>
            </GradientBanner>
            <ClusterAnalysis
              clusters={clusters.data}
              interpretations={clusters.interpretation}
              scatterData={clusters.scatter_data}
              method={clusters.method}
            />
          </div>
        )}
        
        {/* Weekday Analysis Section */}
        {byWeekday && (
          <div ref={weekdayAnalysisRef}>
            <GradientBanner className="py-8 mt-20" isExport={isExportPDF}>
              <div className="container mx-auto">
                <Card className="bg-card/90 shadow-glow/10 p-6 md:p-8 max-w-4xl mx-auto">
                  <div className="text-center space-y-4">
                    <h2 className={
                      `text-3xl md:text-4xl font-bold leading-tight pb-1 ` +
                      (isExportPDF
                        ? 'text-primary'
                        : 'bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent')
                    }>
                      Weekday Analysis
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      Find out on which days of the week you are performing best and worst.
                    </p>
                  </div>
                </Card>
              </div>
            </GradientBanner>
            <WeekdayAnalysis byWeekday={byWeekday} />
          </div>
        )}
        
        {/* Session Assistant Section */}
        {sessionAssistant && (
          <div ref={sessionAssistantRef}>
            <GradientBanner className="py-8 mt-20" isExport={isExportPDF}>
              <div className="container mx-auto">
                <Card className="bg-card/90 shadow-glow/10 p-6 md:p-8 max-w-4xl mx-auto">
                  <div className="text-center space-y-4">
                    <h2 className={
                      `text-3xl md:text-4xl font-bold leading-tight pb-1 ` +
                      (isExportPDF
                        ? 'text-primary'
                        : 'bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent')
                    }>
                      Session Assistant
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      Get personalized insights and recommendations for your trading sessions.
                    </p>
                  </div>
                </Card>
              </div>
            </GradientBanner>
            <SessionAssistantAnalysis sessionAssistant={sessionAssistant} />
          </div>
        )}
        
        {/* Analysis Dock */}
        <AnalysisDock
          onSectionSelect={handleSectionSelect}
          activeSection={activeSection}
          hasAnalysisResults={!!analysis}
          hasClusterResults={!!clusters}
          hasWeekdayResults={!!byWeekday}
          hasSessionAssistantResults={!!sessionAssistant}
        />
      </div>
      
      {/* Export to PDF Button */}
      <div className="flex justify-center mt-8">
        <SmartPageBreakPDF
          elementRef={allAnalysisRef}
          filename={`trading-analysis-${new Date().toISOString().split('T')[0]}.pdf`}
          title="Export to PDF"
          hasCharts={true}
          setIsExportPDF={setIsExportPDF}
        />
      </div>
    </div>
  );
}