import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle } from 'lucide-react';
import { smartPageBreakPDF, smartPageBreakPDFWithCharts } from '@/utils/smartPageBreakPDF';

interface SmartPageBreakPDFProps {
  elementRef: React.RefObject<HTMLDivElement>;
  filename?: string;
  title?: string;
  hasCharts?: boolean;
  setIsExportPDF?: (val: boolean) => void;
}

export const SmartPageBreakPDF: React.FC<SmartPageBreakPDFProps> = ({
  elementRef,
  filename = `trading-analysis-${new Date().toISOString().split('T')[0]}.pdf`,
  title = 'Export to PDF',
  hasCharts = true,
  setIsExportPDF
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const generatePDF = async () => {
    if (!elementRef.current) {
      alert('No content to export');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);

    try {
      // 1. Set export flag (this should trigger Dashboard re-render)
      setIsExportPDF?.(true);
      // 2. Wait for DOM update
      await new Promise(res => setTimeout(res, 100));

      // 3. Run export
      if (hasCharts) {
        await smartPageBreakPDFWithCharts(elementRef.current, {
          filename,
          scale: 2,
          quality: 0.95
        });
      } else {
        await smartPageBreakPDF(elementRef.current, {
          filename,
          scale: 2,
          quality: 0.95
        });
      }

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      // 4. Reset export flag
      setIsExportPDF?.(false);
      setIsExporting(false);
    }
  };

  return (
    <Button 
      onClick={generatePDF}
      disabled={isExporting}
      className="flex items-center gap-2"
      size="lg"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating PDF...
        </>
      ) : exportSuccess ? (
        <>
          <CheckCircle className="h-4 w-4" />
          PDF Generated!
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          {title}
        </>
      )}
    </Button>
  );
}; 