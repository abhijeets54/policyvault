import { UploadAndExtract } from "@/components/UploadAndExtract";

export default function NewPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Upload policy</h1>
        <p className="text-muted-foreground text-sm">PDF only. AI will extract the key fields, then you confirm before saving.</p>
      </div>
      <UploadAndExtract />
    </div>
  );
}
