import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Fingerprint,
  LockKeyhole,
} from "lucide-react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { DocContent } from "./DocContent";
import { docTopics } from "./topics";
import { SelectField } from "../../components/SelectField";
import "./docs.css";

const topicOptions = docTopics.map((topic) => ({
  key: topic.id,
  label: topic.label,
}));

export function DocsPage({ backTo }: { backTo: string }) {
  const { section } = useParams();
  const navigate = useNavigate();
  const topicIndex = docTopics.findIndex((topic) => topic.id === section);
  const topic = docTopics[topicIndex];
  const TopicIcon = topic?.icon ?? BookOpen;
  const next = docTopics[topicIndex + 1];
  const heading = useRef<HTMLHeadingElement>(null);
  const article = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousTitle = document.title;
    article.current?.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
    document.title = `${topic?.label ?? "Topic not found"} · Hashproof Docs`;
    return () => {
      document.title = previousTitle;
    };
  }, [topic]);

  return (
    <div className="docs-shell">
      <header className="docs-topbar">
        <Link className="brand" to={backTo} aria-label="Hashproof workspace">
          <span className="brand-mark">
            <Fingerprint />
          </span>
          <span>
            Hashproof<small>DOCUMENTATION</small>
          </span>
        </Link>
        <Link className="docs-back" to={backTo}>
          <ArrowLeft size={16} />
          Back to workspace
        </Link>
      </header>
      <main className="docs-layout">
        <aside className="docs-sidebar">
          <div className="docs-sidebar-heading">
            <BookOpen size={18} />
            <span>THE GUIDE</span>
          </div>
          <nav className="docs-navigation" aria-label="Documentation topics">
            {docTopics.map(({ id, label, icon: Icon }) => (
              <NavLink key={id} to={`/docs/${id}`}>
                <Icon size={17} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="docs-mobile-navigation">
            <SelectField
              label="Documentation topic"
              placeholder="Choose a topic"
              value={topic?.id ?? ""}
              options={topicOptions}
              onChange={(id) => navigate(`/docs/${id}`)}
            />
          </div>
          <p className="docs-retention-note">
            <LockKeyhole size={16} aria-hidden="true" />
            Keep your files.
            <br />
            Export your proof.
          </p>
        </aside>
        <article
          className="docs-article"
          ref={article}
          aria-labelledby="docs-heading"
        >
          <header className="docs-article-heading">
            <div className="docs-topic-mark">
              <span className="docs-topic-icon">
                <TopicIcon size={22} aria-hidden="true" />
              </span>
              <span className="eyebrow">
                {topic?.id === "developers" ? "DEVELOPERS" : "USER GUIDE"}
              </span>
              {topic && (
                <span className="docs-topic-number">
                  {String(topicIndex + 1).padStart(2, "0")} /{" "}
                  {String(docTopics.length).padStart(2, "0")}
                </span>
              )}
            </div>
            <h1 id="docs-heading" ref={heading} tabIndex={-1}>
              {topic?.title ?? "Topic not found"}
            </h1>
            <p>
              {topic?.description ??
                "This documentation address does not match an available topic."}
            </p>
          </header>
          {topic ? (
            <>
              <div className="docs-prose">
                <DocContent topic={topic.id} />
              </div>
              <div className="docs-article-footer">
                <Link to={backTo}>
                  <ArrowLeft size={15} />
                  Back to workspace
                </Link>
                {next && (
                  <Link to={`/docs/${next.id}`}>
                    {next.label}
                    <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </>
          ) : (
            <Link className="docs-back" to="/docs/getting-started">
              Open Getting started
              <ArrowRight size={16} />
            </Link>
          )}
        </article>
      </main>
    </div>
  );
}
