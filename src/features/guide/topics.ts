import {
  Code2,
  Fingerprint,
  GitBranch,
  History,
  Files,
  Layers,
  Lightbulb,
  Rocket,
  Wallet,
} from "lucide-react";

export const docTopics = [
  {
    id: "getting-started",
    label: "Getting started",
    title: "Timestamp and check a file",
    description:
      "From your first file to a verifiable record, one step at a time.",
    icon: Rocket,
  },
  {
    id: "how-it-works",
    label: "How it works",
    title: "What a timestamp proves",
    description:
      "Understand commitments, linked history and the limits of the evidence.",
    icon: Fingerprint,
  },
  {
    id: "use-cases",
    label: "Use cases",
    title: "Put your file history to work",
    description:
      "Practical workflows for documents, research, releases and collections.",
    icon: Lightbulb,
  },
  {
    id: "branch",
    label: "File versions / Branch",
    title: "Update a file with Branch",
    description:
      "Connect a new file version to an existing record without overwriting it.",
    icon: GitBranch,
  },
  {
    id: "identifiers",
    label: "IDs, aggregates & votes",
    title: "Identifiers, Batch / Pack and votes",
    description:
      "Choose the right identifier and understand how records stay live.",
    icon: Layers,
  },
  {
    id: "restore",
    label: "History / Restore",
    title: "Save history and use Restore",
    description:
      "Keep your evidence, check its links, and restore records when possible.",
    icon: History,
  },
  {
    id: "proofs",
    label: "Proof files",
    title: "Combine your proof files",
    description:
      "Merge retained history into one portable SDK archive, entirely in your browser.",
    icon: Files,
  },
  {
    id: "wallet",
    label: "Wallet & fees",
    title: "Wallet, fees and disconnect",
    description:
      "What needs a signature, what costs a fee, and what the browser remembers.",
    icon: Wallet,
  },
  {
    id: "developers",
    label: "Developer resources",
    title: "Build with Hash Timestamp",
    description: "The repositories, SDK and references behind this workspace.",
    icon: Code2,
  },
] as const;

export type DocTopicId = (typeof docTopics)[number]["id"];
