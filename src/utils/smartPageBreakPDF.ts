import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFExportOptions {
  filename?: string;
  format?: 'a4' | 'a3' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  scale?: number;
  quality?: number;
}

export const smartPageBreakPDF = async (
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<void> => {
  const {
    filename = `export-${new Date().toISOString().split('T')[0]}.pdf`,
    format = 'a4',
    orientation = 'portrait',
    margin = 24,
    scale = 2,
    quality = 0.95
  } = options;

  try {
    // Wait a moment for any animations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get the computed background color from the body or document
    const bodyStyle = window.getComputedStyle(document.body);
    const backgroundColor = bodyStyle.backgroundColor || '#0f172a';
    
    // Create a wrapper div with padding to simulate margins
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: ${element.offsetWidth + (margin * 2)}px;
      height: ${element.offsetHeight + (margin * 2)}px;
      padding: ${margin}px;
      background-color: ${backgroundColor};
      box-sizing: border-box;
    `;
    
    // Clone the element and add it to the wrapper
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // Capture Chart.js canvases from original and replace in clone
    await captureAndReplaceChartJsCanvases(element, clonedElement);
    
    // Simple badge text fix - just ensure proper font weight and centering
    const badges = clonedElement.querySelectorAll('[class*="badge"], .badge, [class*="Badge"]');
    badges.forEach(badge => {
      const badgeElement = badge as HTMLElement;
      badgeElement.style.fontWeight = '600';
      badgeElement.style.fontSize = '12px';
      badgeElement.style.textAlign = 'center';
      badgeElement.style.display = 'inline-flex';
      badgeElement.style.alignItems = 'center';
      badgeElement.style.justifyContent = 'center';
    });
    
    wrapper.appendChild(clonedElement);
    document.body.appendChild(wrapper);
    
    // Create PDF with matching background
    const pdf = new jsPDF(orientation, 'mm', format);
    
    // Calculate available content area - NO PDF MARGINS
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth; // Full page width
    const contentHeight = pageHeight; // Full page height
    
    console.log('Capturing element with HTML padding...');
    
    // Capture the wrapper (which includes the padding) with improved text rendering
    const canvas = await html2canvas(wrapper, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: backgroundColor,
      logging: false,
      width: wrapper.offsetWidth,
      height: wrapper.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      onclone: (clonedDoc) => {
        // Process Chart.js canvases in the cloned document
        const clonedWrapper = clonedDoc.querySelector('div') as HTMLElement;
        if (clonedWrapper) {
          processChartJsCanvasesInClone(clonedWrapper);
        }
      }
    });
    
    // Clean up the wrapper
    document.body.removeChild(wrapper);
    
    console.log('Canvas captured, dimensions:', canvas.width, 'x', canvas.height);
    
    // Calculate dimensions - full page coverage
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    console.log('PDF dimensions:', imgWidth, 'x', imgHeight, 'mm');
    console.log('Page height:', pageHeight, 'mm, Content height:', contentHeight, 'mm');
    
    // Simple page break logic - split into pages if content is too tall
    let currentY = 0; // Start at top of page
    let remainingHeight = imgHeight;
    let isFirstPage = true;
    
    while (remainingHeight > 0) {
      // Set background for the page
      if (isFirstPage) {
        pdf.setFillColor(backgroundColor);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
        isFirstPage = false;
      } else {
        pdf.addPage();
        pdf.setFillColor(backgroundColor);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
        currentY = 0; // Start at top of new page
      }
      
      // Calculate how much content fits on this page
      const heightForThisPage = Math.min(remainingHeight, contentHeight);
      const sourceHeight = (heightForThisPage * canvas.height) / imgHeight;
      const sourceY = ((imgHeight - remainingHeight) * canvas.height) / imgHeight;
      
      console.log(`Page: height=${heightForThisPage}, sourceY=${sourceY}, sourceHeight=${sourceHeight}`);
      
      // Create a temporary canvas for this page's content
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;
        
        // Draw the cropped portion of the original canvas
        tempCtx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight,
          0, 0, canvas.width, sourceHeight
        );
        
        // Add the cropped image to the PDF - NO MARGINS
        pdf.addImage(
          tempCanvas.toDataURL('image/jpeg', quality),
          'JPEG',
          0, // No left margin
          currentY, // No top margin
          imgWidth,
          heightForThisPage
        );
      }
      
      // Update position for next page
      remainingHeight -= heightForThisPage;
      currentY = 0; // Reset to top for next page
    }
    
    console.log('Saving PDF...');
    
    // Save the PDF
    pdf.save(filename);
    
    console.log('PDF saved successfully!');
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
};

// Alternative approach for better chart handling
export const smartPageBreakPDFWithCharts = async (
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<void> => {
  const {
    filename = `export-${new Date().toISOString().split('T')[0]}.pdf`,
    format = 'a4',
    orientation = 'portrait',
    margin = 24,
    scale = 2,
    quality = 0.95
  } = options;

  try {
    // Wait for charts to render
    await waitForChartsToRender(element);
    
    // Additional delay for Chart.js charts which might need more time
    const chartJsCharts = element.querySelectorAll('canvas');
    if (chartJsCharts.length > 0) {
      console.log(`Found ${chartJsCharts.length} Chart.js charts, waiting additional time...`);
      
      // Force re-render of all Chart.js charts
      chartJsCharts.forEach((canvas, index) => {
        const canvasElement = canvas as HTMLCanvasElement;
        const chartInstance = (canvasElement as any).chart;
        if (chartInstance && typeof chartInstance.resize === 'function') {
          console.log(`Forcing re-render of Chart.js chart ${index}`);
          try {
            chartInstance.resize();
            chartInstance.render();
          } catch (error) {
            console.warn(`Failed to re-render Chart.js chart ${index}:`, error);
          }
        }
      });
      
      // Wait for Chart.js charts to complete rendering
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Wait a moment for any animations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the computed background color from the body or document
    const bodyStyle = window.getComputedStyle(document.body);
    const backgroundColor = bodyStyle.backgroundColor || '#0f172a';
    
    // Create a wrapper div with padding to simulate margins
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      width: ${element.offsetWidth + (margin * 2)}px;
      height: ${element.offsetHeight + (margin * 2)}px;
      padding: ${margin}px;
      background-color: ${backgroundColor};
      box-sizing: border-box;
    `;
    
    // Clone the element and add it to the wrapper
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // Capture Chart.js canvases from original and replace in clone
    await captureAndReplaceChartJsCanvases(element, clonedElement);
    
    // Simple badge text fix - just ensure proper font weight and centering
    const badges = clonedElement.querySelectorAll('[class*="badge"], .badge, [class*="Badge"]');
    badges.forEach(badge => {
      const badgeElement = badge as HTMLElement;
      badgeElement.style.fontWeight = '600';
      badgeElement.style.fontSize = '12px';
      badgeElement.style.textAlign = 'center';
      badgeElement.style.display = 'inline-flex';
      badgeElement.style.alignItems = 'center';
      badgeElement.style.justifyContent = 'center';
    });
    
    wrapper.appendChild(clonedElement);
    document.body.appendChild(wrapper);
    
    // Create PDF with matching background
    const pdf = new jsPDF(orientation, 'mm', format);
    
    // Calculate available content area - NO PDF MARGINS
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth; // Full page width
    const contentHeight = pageHeight; // Full page height
    
    console.log('Capturing element with charts and HTML padding...');
    
    // Capture the wrapper (which includes the padding) with improved text rendering
    const canvas = await html2canvas(wrapper, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: backgroundColor,
      logging: false,
      width: wrapper.offsetWidth,
      height: wrapper.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      onclone: (clonedDoc) => {
        // Process Chart.js canvases in the cloned document
        const clonedWrapper = clonedDoc.querySelector('div') as HTMLElement;
        if (clonedWrapper) {
          processChartJsCanvasesInClone(clonedWrapper);
        }
      }
    });
    
    // Clean up the wrapper
    document.body.removeChild(wrapper);
    
    console.log('Canvas captured with charts, dimensions:', canvas.width, 'x', canvas.height);
    
    // Calculate dimensions - full page coverage
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    console.log('PDF dimensions:', imgWidth, 'x', imgHeight, 'mm');
    console.log('Page height:', pageHeight, 'mm, Content height:', contentHeight, 'mm');
    
    // Simple page break logic - split into pages if content is too tall
    let currentY = 0; // Start at top of page
    let remainingHeight = imgHeight;
    let isFirstPage = true;
    
    while (remainingHeight > 0) {
      // Set background for the page
      if (isFirstPage) {
        pdf.setFillColor(backgroundColor);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
        isFirstPage = false;
      } else {
        pdf.addPage();
        pdf.setFillColor(backgroundColor);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
        currentY = 0; // Start at top of new page
      }
      
      // Calculate how much content fits on this page
      const heightForThisPage = Math.min(remainingHeight, contentHeight);
      const sourceHeight = (heightForThisPage * canvas.height) / imgHeight;
      const sourceY = ((imgHeight - remainingHeight) * canvas.height) / imgHeight;
      
      console.log(`Page with charts: height=${heightForThisPage}, sourceY=${sourceY}, sourceHeight=${sourceHeight}`);
      
      // Create a temporary canvas for this page's content
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;
        
        // Draw the cropped portion of the original canvas
        tempCtx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight,
          0, 0, canvas.width, sourceHeight
        );
        
        // Add the cropped image to the PDF - NO MARGINS
        pdf.addImage(
          tempCanvas.toDataURL('image/jpeg', quality),
          'JPEG',
          0, // No left margin
          currentY, // No top margin
          imgWidth,
          heightForThisPage
        );
      }
      
      // Update position for next page
      remainingHeight -= heightForThisPage;
      currentY = 0; // Reset to top for next page
    }
    
    console.log('Saving PDF with charts...');
    
    pdf.save(filename);
    
    console.log('PDF with charts saved successfully!');
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw error;
  }
};

// Helper function to wait for charts to render
const waitForChartsToRender = async (container: HTMLElement, timeout = 10000): Promise<void> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkCharts = () => {
      const plotlyCharts = container.querySelectorAll('.plotly-graph-div');
      const chartJsCharts = container.querySelectorAll('canvas');
      
      console.log(`Checking charts: ${plotlyCharts.length} Plotly, ${chartJsCharts.length} Chart.js`);
      
      let allRendered = true;
      
      // Check Plotly charts
      if (plotlyCharts.length > 0) {
        plotlyCharts.forEach((chartDiv, index) => {
          const svg = chartDiv.querySelector('svg');
          if (!svg || svg.children.length === 0) {
            console.log(`Plotly chart ${index} not ready`);
            allRendered = false;
          } else {
            console.log(`Plotly chart ${index} ready`);
          }
        });
      }
      
      // Check Chart.js charts - improved detection
      if (chartJsCharts.length > 0) {
        chartJsCharts.forEach((canvas, index) => {
          const canvasElement = canvas as HTMLCanvasElement;
          
          // Check if canvas has dimensions
          if (canvasElement.width === 0 || canvasElement.height === 0) {
            console.log(`Chart.js canvas ${index} has no dimensions`);
            allRendered = false;
            return;
          }
          
          // Check if canvas is visible
          const rect = canvasElement.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            console.log(`Chart.js canvas ${index} has no visible dimensions`);
            allRendered = false;
            return;
          }
          
          // Check if this is actually a Chart.js canvas
          const chartInstance = (canvasElement as any).chart;
          if (!chartInstance) {
            console.log(`Canvas ${index} is not a Chart.js chart, skipping`);
            return;
          }
          
          // Check if chart has been rendered
          try {
            const ctx = canvasElement.getContext('2d');
            if (ctx) {
              // Sample a small area to check for content
              const sampleWidth = Math.min(canvasElement.width, 50);
              const sampleHeight = Math.min(canvasElement.height, 50);
              const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
              
              // Check if there's any non-transparent content
              let hasContent = false;
              for (let i = 3; i < imageData.data.length; i += 4) {
                if (imageData.data[i] > 0) { // Alpha channel > 0
                  hasContent = true;
                  break;
                }
              }
              
              if (!hasContent) {
                console.log(`Chart.js canvas ${index} has no visible content`);
                allRendered = false;
              } else {
                console.log(`Chart.js canvas ${index} ready with content`);
              }
            }
          } catch (error) {
            console.log(`Chart.js canvas ${index} error checking content:`, error);
            // If we can't check content, assume it's ready if dimensions are good
            console.log(`Chart.js canvas ${index} ready (fallback)`);
          }
        });
      }
      
      // If no charts found or all charts are rendered, resolve
      if (plotlyCharts.length === 0 && chartJsCharts.length === 0) {
        console.log('No charts found, proceeding');
        resolve();
        return;
      }
      
      if (allRendered) {
        console.log('All charts ready, proceeding');
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        console.warn('Chart rendering timeout, proceeding anyway');
        resolve();
        return;
      }
      
      setTimeout(checkCharts, 500); // Increased interval for better detection
    };
    
    checkCharts();
  });
};

// Helper function to process Chart.js canvases in html2canvas onclone callback
const processChartJsCanvasesInClone = (clonedElement: HTMLElement): void => {
  const canvases = clonedElement.querySelectorAll('canvas');
  console.log(`Processing ${canvases.length} canvases in html2canvas clone callback`);
  
  canvases.forEach((canvas, index) => {
    try {
      const canvasElement = canvas as HTMLCanvasElement;
      
      // Check if this is a Chart.js canvas by looking for Chart.js instance
      const chartInstance = (canvasElement as any).chart;
      if (chartInstance && typeof chartInstance.resize === 'function') {
        console.log(`Processing Chart.js chart ${index} (${chartInstance.config?.type || 'unknown type'}) in clone`);
        
        // Force re-render
        try {
          chartInstance.resize();
          chartInstance.render();
        } catch (error) {
          console.warn(`Failed to re-render Chart.js chart ${index} in clone:`, error);
        }
        
        // Wait for render to complete and convert to image
        setTimeout(() => {
          try {
            // Create image from canvas
            const img = document.createElement('img') as HTMLImageElement;
            
            // Copy styles from canvas
            img.style.cssText = canvasElement.style.cssText;
            img.style.width = canvasElement.width + 'px';
            img.style.height = canvasElement.height + 'px';
            img.style.display = 'block';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            
            // Convert to data URL with better quality
            const dataURL = canvasElement.toDataURL('image/png', 1.0);
            img.src = dataURL;
            img.alt = `Chart ${index + 1}`;
            
            // Replace canvas with image
            if (canvasElement.parentNode) {
              canvasElement.parentNode.insertBefore(img, canvasElement);
              canvasElement.style.display = 'none';
              console.log(`Successfully converted Chart.js canvas ${index} to image in clone`);
            }
          } catch (error) {
            console.warn(`Failed to convert Chart.js canvas ${index} in clone:`, error);
          }
        }, 150); // Increased wait time for better rendering
      } else {
        // Not a Chart.js canvas, but still try to capture it as an image
        console.log(`Processing non-Chart.js canvas ${index} in clone`);
        try {
          const img = document.createElement('img') as HTMLImageElement;
          img.style.cssText = canvasElement.style.cssText;
          img.style.width = canvasElement.width + 'px';
          img.style.height = canvasElement.height + 'px';
          img.style.display = 'block';
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          
          const dataURL = canvasElement.toDataURL('image/png', 1.0);
          img.src = dataURL;
          img.alt = `Canvas ${index + 1}`;
          
          if (canvasElement.parentNode) {
            canvasElement.parentNode.insertBefore(img, canvasElement);
            canvasElement.style.display = 'none';
            console.log(`Successfully converted non-Chart.js canvas ${index} to image in clone`);
          }
        } catch (error) {
          console.warn(`Failed to convert non-Chart.js canvas ${index} in clone:`, error);
        }
      }
    } catch (error) {
      console.warn(`Failed to process canvas ${index} in clone:`, error);
    }
  });
};

// Helper function to restore Chart.js canvases after capture
const restoreChartJsCanvases = (element: HTMLElement): void => {
  const images = element.querySelectorAll('img[alt^="Chart "]');
  images.forEach((img) => {
    const canvas = img.nextElementSibling;
    if (canvas && canvas.tagName === 'CANVAS') {
      (canvas as HTMLElement).style.display = '';
      img.remove();
    }
  });
};

// Helper function to capture Chart.js canvases from original element and replace in clone
const captureAndReplaceChartJsCanvases = async (originalElement: HTMLElement, clonedElement: HTMLElement): Promise<void> => {
  const originalCanvases = originalElement.querySelectorAll('canvas');
  const clonedCanvases = clonedElement.querySelectorAll('canvas');
  
  if (originalCanvases.length !== clonedCanvases.length) {
    console.warn('Canvas count mismatch between original and clone');
    return;
  }
  
  console.log(`Processing ${originalCanvases.length} canvases for Chart.js conversion`);
  
  const capturePromises: Promise<void>[] = [];
  
  originalCanvases.forEach((originalCanvas, index) => {
    const capturePromise = new Promise<void>((resolve) => {
      try {
        const originalCanvasElement = originalCanvas as HTMLCanvasElement;
        const clonedCanvasElement = clonedCanvases[index] as HTMLCanvasElement;
        
        // Check if this is a Chart.js canvas
        const chartInstance = (originalCanvasElement as any).chart;
        if (chartInstance && typeof chartInstance.resize === 'function') {
          console.log(`Capturing Chart.js chart ${index} (${chartInstance.config?.type || 'unknown type'})`);
          
          // Force re-render on original chart
          try {
            chartInstance.resize();
            chartInstance.render();
            
            // Additional wait for Chart.js to complete rendering
            setTimeout(() => {
              try {
                // Create image from original canvas
                const img = document.createElement('img') as HTMLImageElement;
                
                // Copy styles from canvas
                img.style.cssText = originalCanvasElement.style.cssText;
                img.style.width = originalCanvasElement.width + 'px';
                img.style.height = originalCanvasElement.height + 'px';
                img.style.display = 'block';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                
                // Convert canvas to data URL with better quality
                const dataURL = originalCanvasElement.toDataURL('image/png', 1.0);
                img.src = dataURL;
                img.alt = `Chart ${index + 1}`;
                
                // Ensure image loads before replacing
                img.onload = () => {
                  // Replace cloned canvas with image
                  if (clonedCanvasElement.parentNode) {
                    clonedCanvasElement.parentNode.insertBefore(img, clonedCanvasElement);
                    clonedCanvasElement.style.display = 'none';
                    console.log(`Successfully replaced Chart.js canvas ${index} with image`);
                  }
                  resolve();
                };
                
                img.onerror = () => {
                  console.warn(`Failed to load image for Chart.js canvas ${index}, keeping original canvas`);
                  resolve();
                };
                
              } catch (error) {
                console.warn(`Failed to capture Chart.js canvas ${index}:`, error);
                // Keep original canvas if conversion fails
                resolve();
              }
            }, 300); // Increased wait time for Chart.js rendering
            
          } catch (error) {
            console.warn(`Failed to re-render Chart.js chart ${index}:`, error);
            resolve();
          }
        } else {
          // Not a Chart.js canvas, but still try to convert it as a fallback
          console.log(`Canvas ${index} is not a Chart.js chart, attempting fallback conversion`);
          try {
            const img = document.createElement('img') as HTMLImageElement;
            img.style.cssText = originalCanvasElement.style.cssText;
            img.style.width = originalCanvasElement.width + 'px';
            img.style.height = originalCanvasElement.height + 'px';
            img.style.display = 'block';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            
            const dataURL = originalCanvasElement.toDataURL('image/png', 1.0);
            img.src = dataURL;
            img.alt = `Canvas ${index + 1}`;
            
            img.onload = () => {
              if (clonedCanvasElement.parentNode) {
                clonedCanvasElement.parentNode.insertBefore(img, clonedCanvasElement);
                clonedCanvasElement.style.display = 'none';
                console.log(`Successfully converted non-Chart.js canvas ${index} to image`);
              }
              resolve();
            };
            
            img.onerror = () => {
              console.warn(`Failed to convert non-Chart.js canvas ${index}, keeping original`);
              resolve();
            };
            
          } catch (error) {
            console.warn(`Failed to convert non-Chart.js canvas ${index}:`, error);
            resolve();
          }
        }
      } catch (error) {
        console.warn(`Failed to process canvas ${index}:`, error);
        resolve();
      }
    });
    
    capturePromises.push(capturePromise);
  });
  
  // Wait for all captures to complete
  await Promise.all(capturePromises);
  console.log('All canvases processed for PDF export');
};

// Simple print function as fallback
export const printElement = (element: HTMLElement): void => {
  // Create print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Preview</title>
          <style>
            body { 
              margin: 0;
              padding: 20px;
              background: #0f172a;
              color: #e5e7eb;
            }
            @media print {
              body { background: white; color: black; }
            }
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  }
}; 