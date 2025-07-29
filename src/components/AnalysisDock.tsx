import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  PieChart, 
  Calendar,
  TrendingUp,
  Target,
  Activity
} from 'lucide-react';

interface DockItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

interface AnalysisDockProps {
  onSectionSelect: (sectionId: string) => void;
  activeSection: string;
  hasAnalysisResults: boolean;
  hasClusterResults: boolean;
  hasWeekdayResults: boolean;
  hasSessionAssistantResults: boolean;
}

const dockItems: DockItem[] = [
  {
    id: 'analysis',
    label: 'Analysis Results',
    icon: BarChart3,
    color: '#3b82f6',
    description: 'Performance metrics and recommendations'
  },
  {
    id: 'clusters',
    label: 'Cluster Analysis',
    icon: PieChart,
    color: '#0ea5e9',
    description: 'Trade pattern clustering insights'
  },
  {
    id: 'weekday',
    label: 'Weekday Analysis',
    icon: Calendar,
    color: '#06b6d4',
    description: 'Day-of-week performance patterns'
  },
  {
    id: 'session-assistant',
    label: 'Session Assistant',
    icon: TrendingUp,
    color: '#10b981',
    description: 'Real-time trading session guidance'
  }
];

export const AnalysisDock: React.FC<AnalysisDockProps> = ({
  onSectionSelect,
  activeSection,
  hasAnalysisResults,
  hasClusterResults,
  hasWeekdayResults,
  hasSessionAssistantResults
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const getAvailableItems = () => {
    const items = [];
    if (hasAnalysisResults) items.push(dockItems[0]);
    if (hasClusterResults) items.push(dockItems[1]);
    if (hasWeekdayResults) items.push(dockItems[2]);
    if (hasSessionAssistantResults) items.push(dockItems[3]);
    return items;
  };

  const availableItems = getAvailableItems();

  if (availableItems.length === 0) return null;

  return (
    <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
      <motion.div
        className="flex flex-col items-center gap-2 bg-background/80 backdrop-blur-md border border-border/50 rounded-full px-2 py-4 shadow-lg"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        {availableItems.map((item, index) => {
          const isActive = activeSection === item.id;
          const isHovered = hoveredIndex === index;
          
          return (
            <motion.button
              key={item.id}
              className="relative group"
              onClick={() => onSectionSelect(item.id)}
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-200 ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
                style={{
                  backgroundColor: isActive ? item.color : undefined,
                }}
                layout
              >
                <item.icon className="w-5 h-5" />
              </motion.div>
              
                             {/* Tooltip */}
               <AnimatePresence>
                 {isHovered && (
                   <motion.div
                     className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 bg-foreground text-background text-sm rounded-lg shadow-lg whitespace-nowrap"
                     initial={{ opacity: 0, x: 10, scale: 0.9 }}
                     animate={{ opacity: 1, x: 0, scale: 1 }}
                     exit={{ opacity: 0, x: 10, scale: 0.9 }}
                     transition={{ duration: 0.2 }}
                   >
                     <div className="font-medium">{item.label}</div>
                     <div className="text-xs opacity-80">{item.description}</div>
                     <div 
                       className="absolute top-1/2 right-full transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-foreground"
                     />
                   </motion.div>
                 )}
               </AnimatePresence>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}; 