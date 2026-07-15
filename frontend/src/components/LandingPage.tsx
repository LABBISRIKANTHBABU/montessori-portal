import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight, Shield } from "lucide-react";
import { api, School } from "../api";
import { orderVisibleSchools } from "../schools/visibleSchools";
import { Brand } from "../App";

const GROUP_LOGO = "/montessori-golden-jubilee-logo.jpeg";

export function LandingPage() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.schools().then(r => {
      setSchools(orderVisibleSchools(r.data));
      setLoading(false);
    }).catch(reason => {
      setError(reason instanceof Error ? reason.message : "Schools could not be loaded.");
      setLoading(false);
    });
  }, []);

  return (
    <main className="landing-new">
      <nav className="landing-nav">
        <Brand />
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/super-admin")}>
          <Shield size={14} /> Platform Admin
        </button>
      </nav>

      <section className="landing-header">
        <span className="eyebrow">MONTESSORI GROUP OF SCHOOLS</span>
        <h1 className="heading-1">Select your campus</h1>
        <p className="body-lg" style={{ color: "var(--color-text-secondary)", maxWidth: 480, margin: "0 auto" }}>
          Choose your school to sign in to your workspace.
        </p>
      </section>

      <section className="school-grid-container">
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: "var(--space-16)" }}>
            <div className="spinner-lg" />
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ maxWidth: 600, margin: "0 auto" }}>
            {error}
          </div>
        ) : (
          <div className="school-grid stagger-children">
            {schools.map((school) => (
              <button
                key={school.id}
                className="school-card animate-slide-up"
                onClick={() => navigate(`/login/${school.id}`)}
              >
                <div className="school-card-icon">
                  <img src={GROUP_LOGO} alt="" aria-hidden="true" />
                </div>
                <div className="school-card-info">
                  <strong>{school.name}</strong>
                  {school.city && (
                    <small>
                      <Building2 size={12} /> {school.city}
                    </small>
                  )}
                </div>
                <ArrowRight size={18} className="school-card-arrow" />
              </button>
            ))}
          </div>
        )}
      </section>

      <footer className="landing-foot">
        <span>Montessori Group of Schools</span>
        <span>ERP Platform v1.0</span>
      </footer>
    </main>
  );
}
