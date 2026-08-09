import { useState } from "react";
import { Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface SizeGuideModalProps {
  hasHumanSizes: boolean;
  hasPetSizes: boolean;
  children: React.ReactNode;
}

export function SizeGuideModal({ hasHumanSizes, hasPetSizes, children }: SizeGuideModalProps) {
  const [activeTab, setActiveTab] = useState<"chart" | "measure" | "fit">("chart");
  const [activeSubject, setActiveSubject] = useState<"human" | "pet">(hasHumanSizes ? "human" : "pet");

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 font-body gap-0 rounded-xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/40 sticky top-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-2xl flex items-center gap-2">
              <Ruler className="h-5 w-5 text-[#8b6540]" /> Size Guide
            </DialogTitle>
          </div>
          
          {hasHumanSizes && hasPetSizes && (
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setActiveSubject("human")}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                  activeSubject === "human" 
                    ? "border-[#8b6540] text-foreground" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Owner Sizing
              </button>
              <button
                onClick={() => setActiveSubject("pet")}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                  activeSubject === "pet" 
                    ? "border-[#8b6540] text-foreground" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Pet Sizing
              </button>
            </div>
          )}

          <div className="flex gap-2 bg-muted p-1 rounded-lg mt-4 w-full">
            <button
              onClick={() => setActiveTab("chart")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "chart" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Size Chart
            </button>
            <button
              onClick={() => setActiveTab("measure")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "measure" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              How to Measure
            </button>
            <button
              onClick={() => setActiveTab("fit")}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "fit" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Fit Guide
            </button>
          </div>
        </DialogHeader>

        <div className="p-6 pt-4">
          {activeTab === "chart" && (
            <div className="animate-in fade-in duration-300">
              {activeSubject === "human" ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">Size</th>
                        <th className="px-4 py-3">Chest (in)</th>
                        <th className="px-4 py-3">Shoulder (in)</th>
                        <th className="px-4 py-3 rounded-tr-lg">Length (in)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {[
                        { size: "XS", chest: "34", shoulder: "15", length: "26" },
                        { size: "S", chest: "36", shoulder: "16", length: "27" },
                        { size: "M", chest: "38", shoulder: "17", length: "28" },
                        { size: "L", chest: "40", shoulder: "18", length: "29" },
                        { size: "XL", chest: "42", shoulder: "19", length: "30" },
                        { size: "XXL", chest: "44", shoulder: "20", length: "31" },
                      ].map((row) => (
                        <tr key={row.size} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-semibold">{row.size}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.chest}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.shoulder}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground mt-4 italic">
                    * Measurements are garment dimensions. We recommend choosing a size 1-2 inches larger than your body measurements for a comfortable fit.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg">Size</th>
                        <th className="px-4 py-3">Chest (cm)</th>
                        <th className="px-4 py-3">Back Length (cm)</th>
                        <th className="px-4 py-3 rounded-tr-lg">Neck (cm)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {[
                        { size: "XS", chest: "up to 35", back: "20-25", neck: "20-24" },
                        { size: "S", chest: "35 - 45", back: "25-30", neck: "24-28" },
                        { size: "M", chest: "45 - 55", back: "30-35", neck: "28-32" },
                        { size: "L", chest: "55 - 70", back: "35-45", neck: "32-38" },
                        { size: "XL", chest: "70 - 85", back: "45-55", neck: "38-48" },
                        { size: "XXL", chest: "85 - 100", back: "55-65", neck: "48-58" },
                      ].map((row) => (
                        <tr key={row.size} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-semibold">{row.size}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.chest}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.back}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.neck}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-muted-foreground mt-4 italic">
                    * If your pet is between sizes, or has a thick coat, we recommend sizing up for comfort.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "measure" && (
            <div className="animate-in fade-in duration-300">
              {activeSubject === "human" ? (
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                  <div className="flex-1 w-full max-w-[250px] relative">
                    {/* Minimal Human SVG with Measurement Lines */}
                    <svg viewBox="0 0 200 400" className="w-full h-auto drop-shadow-sm">
                      <rect width="200" height="400" fill="#f8f9fa" rx="8" />
                      <path d="M100 40 C115 40, 125 50, 125 65 C125 80, 115 90, 100 90 C85 90, 75 80, 75 65 C75 50, 85 40, 100 40 Z" fill="#e2e8f0" />
                      <path d="M60 100 L140 100 C155 100, 165 110, 170 125 L180 200 C182 210, 175 220, 165 220 L160 220 L145 130 L135 250 L125 380 C125 390, 115 390, 105 380 L100 250 L95 380 C85 390, 75 390, 75 380 L65 250 L55 130 L40 220 L35 220 C25 220, 18 210, 20 200 L30 125 C35 110, 45 100, 60 100 Z" fill="#cbd5e1" />
                      
                      {/* Shoulder Line */}
                      <line x1="60" y1="105" x2="140" y2="105" stroke="#ef4444" strokeWidth="3" strokeDasharray="4 2" />
                      <circle cx="60" cy="105" r="4" fill="#ef4444" />
                      <circle cx="140" cy="105" r="4" fill="#ef4444" />
                      
                      {/* Chest Line */}
                      <line x1="50" y1="140" x2="150" y2="140" stroke="#3b82f6" strokeWidth="3" strokeDasharray="4 2" />
                      <circle cx="50" cy="140" r="4" fill="#3b82f6" />
                      <circle cx="150" cy="140" r="4" fill="#3b82f6" />
                      
                      {/* Length Line */}
                      <line x1="100" y1="100" x2="100" y2="220" stroke="#10b981" strokeWidth="3" strokeDasharray="4 2" />
                      <circle cx="100" cy="100" r="4" fill="#10b981" />
                      <circle cx="100" cy="220" r="4" fill="#10b981" />
                    </svg>
                  </div>
                  <div className="flex-1 space-y-6">
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block"></span>
                        Shoulder
                      </h4>
                      <p className="text-sm text-muted-foreground">Measure across the back from the edge of one shoulder to the other.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-[#3b82f6] inline-block"></span>
                        Chest
                      </h4>
                      <p className="text-sm text-muted-foreground">Measure around the fullest part of your chest, keeping the measuring tape horizontal.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-[#10b981] inline-block"></span>
                        Length
                      </h4>
                      <p className="text-sm text-muted-foreground">Measure from the highest point of the shoulder down to the desired hemline.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                  <div className="flex-1 w-full max-w-[300px] relative">
                    {/* Minimal Dog SVG with Measurement Lines */}
                    <svg viewBox="0 0 300 250" className="w-full h-auto drop-shadow-sm">
                      <rect width="300" height="250" fill="#f8f9fa" rx="8" />
                      <path d="M220 70 C240 70, 250 80, 250 90 L270 95 C280 98, 280 110, 270 110 L250 110 C240 130, 230 140, 210 140 C190 140, 160 145, 120 145 C100 145, 80 140, 70 120 C65 110, 60 100, 60 90 L80 80 L90 60 C100 40, 110 40, 120 50 C130 60, 150 70, 180 70 Z" fill="#cbd5e1" />
                      
                      {/* Legs */}
                      <path d="M100 145 L100 200 C100 210, 115 210, 115 200 L115 145 Z" fill="#94a3b8" />
                      <path d="M80 135 L75 195 C75 205, 90 205, 90 195 L95 145 Z" fill="#cbd5e1" />
                      <path d="M220 140 L220 195 C220 205, 235 205, 235 195 L235 135 Z" fill="#94a3b8" />
                      <path d="M200 143 L195 190 C195 200, 210 200, 210 190 L210 145 Z" fill="#cbd5e1" />
                      
                      {/* Tail */}
                      <path d="M70 115 C50 110, 40 90, 40 70 C40 60, 50 60, 50 70 C50 80, 60 95, 75 100 Z" fill="#cbd5e1" />
                      
                      {/* Head */}
                      <path d="M210 75 C210 55, 220 40, 240 40 C260 40, 270 55, 270 75 L285 75 C295 75, 295 90, 285 90 L250 90 Z" fill="#cbd5e1" />
                      <circle cx="260" cy="60" r="3" fill="#1e293b" />
                      <path d="M285 80 C290 80, 290 85, 285 85 Z" fill="#1e293b" />
                      <path d="M230 40 C220 20, 200 30, 220 50 Z" fill="#94a3b8" />

                      {/* Neck Line */}
                      <line x1="200" y1="65" x2="230" y2="105" stroke="#ef4444" strokeWidth="3" strokeDasharray="5 3" />
                      <circle cx="200" cy="65" r="4" fill="#ef4444" />
                      <circle cx="230" cy="105" r="4" fill="#ef4444" />
                      
                      {/* Chest Line */}
                      <ellipse cx="205" cy="140" rx="15" ry="30" stroke="#3b82f6" strokeWidth="3" strokeDasharray="5 3" fill="none" transform="rotate(-15 205 140)" />
                      
                      {/* Back Length Line */}
                      <line x1="80" y1="110" x2="210" y2="70" stroke="#10b981" strokeWidth="3" strokeDasharray="5 3" />
                      <circle cx="80" cy="110" r="4" fill="#10b981" />
                      <circle cx="210" cy="70" r="4" fill="#10b981" />
                    </svg>
                  </div>
                  <div className="flex-1 space-y-6">
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block"></span>
                        Neck
                      </h4>
                      <p className="text-sm text-muted-foreground">Measure around the base of the neck, where a collar would sit comfortably. Leave room for two fingers.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-[#3b82f6] inline-block"></span>
                        Chest/Girth
                      </h4>
                      <p className="text-sm text-muted-foreground">Measure around the widest part of your pet's ribcage, usually right behind the front legs.</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-1">
                        <span className="w-3 h-3 rounded-full bg-[#10b981] inline-block"></span>
                        Back Length
                      </h4>
                      <p className="text-sm text-muted-foreground">Measure from the base of the neck to the base of the tail.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "fit" && (
            <div className="animate-in fade-in duration-300 space-y-4">
              <div className="bg-muted/30 p-5 rounded-lg border border-border/40">
                <h4 className="font-semibold mb-2">Regular Fit</h4>
                <p className="text-sm text-muted-foreground">Our standard fit. Not too tight, not too loose. Designed to give you and your pet a comfortable range of motion while looking polished.</p>
              </div>
              <div className="bg-muted/30 p-5 rounded-lg border border-border/40">
                <h4 className="font-semibold mb-2">Between Sizes?</h4>
                <p className="text-sm text-muted-foreground">If you or your pet are in-between sizes, we recommend sizing up. For pets, especially those with thick fur or broad chests (like Bulldogs or Pugs), sizing up is crucial for comfort.</p>
              </div>
              <div className="bg-[#8b6540]/10 p-5 rounded-lg border border-[#8b6540]/20 text-[#8b6540]">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Need sizing help?
                </h4>
                <p className="text-sm">Contact our support team with your measurements or your pet's breed and weight, and we'll help you find the perfect match!</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
