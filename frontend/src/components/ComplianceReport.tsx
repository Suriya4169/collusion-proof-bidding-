import StatusIndicator from "./StatusIndicator";

// Defining the shape of the data based on the backend schemas
interface ComplianceCheck {
  rule_name: string;
  required_value: any;
  actual_value: any;
  is_compliant: boolean;
  compliance_distance_score?: number;
  reason: string;
}

interface VerificationReport {
  overall_status: "PASS" | "FAIL" | "PARTIAL";
  overall_compliance_distance: number;
  checks: ComplianceCheck[];
  plain_summary?: string;
  regional_summary?: string;
  recommended_schemes?: string[];
}

export default function ComplianceReport({ report }: { report: VerificationReport }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-8">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
        <div>
          <h3 className="text-lg leading-6 font-medium text-white">AI Compliance Analysis</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Neurosymbolic Verification complete. Overall Compliance Distance: 
            <span className={`ml-2 font-mono font-bold ${report.overall_compliance_distance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {report.overall_compliance_distance > 0 ? '+' : ''}{report.overall_compliance_distance.toFixed(2)}%
            </span>
          </p>
        </div>
        <StatusIndicator status={report.overall_status} />
      </div>

      {/* Main Summary */}
      <div className="px-6 py-5 border-b border-slate-800">
        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Plain English Summary</h4>
        <p className="text-slate-300 text-sm leading-relaxed">{report.plain_summary}</p>
      </div>
      
      {/* Regional Translation */}
      {report.regional_summary && (
        <div className="px-6 py-5 border-b border-slate-800 bg-blue-900/10">
          <h4 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-2">Regional Translation (Hindi/Tamil)</h4>
          <p className="text-slate-300 text-sm leading-relaxed font-medium">{report.regional_summary}</p>
        </div>
      )}

      {/* Detailed Checks Grid */}
      <div className="px-6 py-5">
        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Detailed Rule Checks</h4>
        <div className="grid grid-cols-1 gap-4">
          {report.checks.map((check, idx) => (
            <div key={idx} className={`p-4 rounded-lg border ${check.is_compliant ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-white">{check.rule_name}</span>
                <StatusIndicator status={check.is_compliant ? "PASS" : "FAIL"} />
              </div>
              <p className="text-xs text-slate-400 mb-3">{check.reason}</p>
              
              <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-slate-700/50">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Tender Required</p>
                  <p className="text-sm font-mono text-slate-300">{String(check.required_value)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Your Profile</p>
                  <p className="text-sm font-mono text-slate-300">{String(check.actual_value)}</p>
                </div>
              </div>
              
              {check.compliance_distance_score !== undefined && (
                <div className="mt-3 text-xs flex items-center gap-2">
                  <span className="text-slate-500">CDS Margin:</span>
                  <span className={`font-mono font-bold ${check.compliance_distance_score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {check.compliance_distance_score > 0 ? '+' : ''}{check.compliance_distance_score.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Recommended Schemes */}
      {report.recommended_schemes && report.recommended_schemes.length > 0 && (
        <div className="px-6 py-5 border-t border-slate-800 bg-purple-900/10">
          <h4 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">AI Recommended Schemes</h4>
          <ul className="list-disc pl-5 space-y-1">
            {report.recommended_schemes.map((scheme, idx) => (
              <li key={idx} className="text-sm text-slate-300">{scheme}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
