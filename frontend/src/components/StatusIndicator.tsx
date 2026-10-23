interface StatusIndicatorProps {
  status: "PASS" | "FAIL" | "PARTIAL";
}

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  let bgColor = "";
  let textColor = "";
  let text = "";

  switch (status) {
    case "PASS":
      bgColor = "bg-green-500/10";
      textColor = "text-green-400";
      text = "🟢 ELIGIBLE";
      break;
    case "FAIL":
      bgColor = "bg-red-500/10";
      textColor = "text-red-400";
      text = "🔴 NOT ELIGIBLE";
      break;
    case "PARTIAL":
      bgColor = "bg-yellow-500/10";
      textColor = "text-yellow-400";
      text = "🟡 PARTIAL";
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${bgColor} ${textColor} border border-${textColor.split('-')[1]}-500/20`}>
      {text}
    </span>
  );
}
