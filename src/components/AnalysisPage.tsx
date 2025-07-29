import React, { useRef } from 'react';
import { AnalysisResults } from './AnalysisResults';
import WeekdayAnalysis from './WeekdayAnalysis';
import { ClusterAnalysis } from './ClusterAnalysis';
import { PDFExport } from './PDFExport';

interface AnalysisPageProps {
  analysis: any;
  plotData: any;
  byWeekday?: any;
  clusters?: any;
  interpretations?: any;
  scatterData?: any;
  method?: string;
  onReset?: () => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  analysis,
  plotData,
  byWeekday,
  clusters,
  interpretations,
  scatterData,
  method,
  onReset
}) => {
  // Create refs for each component
  const analysisResultsRef = useRef<HTMLDivElement>(null);
  const weekdayAnalysisRef = useRef<HTMLDivElement>(null);
  const clusterAnalysisRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Analysis Results Section */}
      <div ref={analysisResultsRef}>
        <AnalysisResults 
          analysis={analysis} 
          plotData={plotData} 
          onReset={onReset}
        />
      </div>

      {/* Weekday Analysis Section */}
      {byWeekday && (
        <div ref={weekdayAnalysisRef}>
          <WeekdayAnalysis byWeekday={byWeekday} />
        </div>
      )}

      {/* Cluster Analysis Section */}
      {clusters && (
        <div ref={clusterAnalysisRef}>
          <ClusterAnalysis 
            clusters={clusters} 
            interpretations={interpretations}
            scatterData={scatterData}
            method={method}
          />
        </div>
      )}

      {/* PDF Export Section */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PDFExport
          analysisResultsRef={analysisResultsRef}
          weekdayAnalysisRef={weekdayAnalysisRef}
          clusterAnalysisRef={clusterAnalysisRef}
          analysisData={analysis}
          plotData={plotData}
        />
      </div>
    </div>
  );
}; 