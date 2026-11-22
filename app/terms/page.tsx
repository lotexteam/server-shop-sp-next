import { permanentRedirect } from "next/navigation";

export default function PolicyPage() {
  permanentRedirect("/blog/terms");
}
