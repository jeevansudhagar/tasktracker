import { useEffect, useState, useCallback } from 'react';
import { projectsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, X, FolderOpen } from 'lucide-react';

function ProjectModal({ project, onClose, onSave }) {
  const [form, setForm] = useState({ name: project?.name || '', description: project?.description || '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (project) { await projectsApi.update(project.id, form); toast.success('Project updated'); }
      else         { await projectsApi.create(form);            toast.success('Project created'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>{project ? 'Edit Project' : 'New Project'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { canManageProjects, isAdmin } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await projectsApi.list({ limit: 100 });
      setProjects(r.data.data.projects);
    } catch { toast.error('Failed to load projects'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this project? Tasks must be completed first.')) return;
    try {
      await projectsApi.delete(id);
      toast.success('Project deactivated');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <>
      <div className="page-header">
        <div><h2>Projects</h2><p>All projects in your organization</p></div>
        {canManageProjects && (
          <button className="btn btn-primary" onClick={() => { setSelected(null); setModal(true); }}>
            <Plus size={15} /> New Project
          </button>
        )}
      </div>

      <div className="page-body">
        {loading
          ? <div className="spinner"><div className="spin" /></div>
          : projects.length === 0
            ? (
              <div className="empty-state">
                <FolderOpen size={48} />
                <p>No projects yet</p>
                <span>Create your first project to get started.</span>
              </div>
            )
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {projects.map(p => (
                  <div className="card" key={p.id} style={{ position: 'relative', transition: 'border-color 0.15s', cursor: 'default' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FolderOpen size={20} color="var(--accent)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                          {p.creator?.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{p.creator?.name}</span>
                      </div>
                      <div>
                        <span className={p.isActive ? 'badge badge-done' : 'badge badge-blocked'}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    {canManageProjects && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(p); setModal(true); }}>Edit</button>
                        {isAdmin && p.isActive && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Deactivate</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
        }
      </div>

      {modal && (
        <ProjectModal project={selected} onClose={() => setModal(false)} onSave={() => { setModal(false); load(); }} />
      )}
    </>
  );
}
