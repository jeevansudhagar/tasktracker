import { useEffect, useState, useCallback } from 'react';
import { tasksApi, projectsApi, usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Plus, LayoutGrid, List, X, ChevronDown, Moon, Sun } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

const STATUSES   = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

const STATUS_NEXT = {
  TODO:        ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW:   ['DONE', 'BLOCKED', 'IN_PROGRESS'],
  DONE:        [],
  BLOCKED:     ['TODO', 'IN_PROGRESS'],
};

const Badge = ({ value, type }) => (
  <span className={`badge badge-${(value || '').toLowerCase().replace('_', '')}`}>{value}</span>
);

// Task Form Modal
function TaskModal({ task, onClose, onSave, projects, users }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'MEDIUM',
    dueDate: task?.dueDate || '',
    projectId: task?.projectId || '',
    assigneeId: task?.assigneeId || '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, assigneeId: form.assigneeId || null, dueDate: form.dueDate || null };
      if (task) {
        await tasksApi.update(task.id, payload);
        toast.success('Task updated');
      } else {
        await tasksApi.create(payload);
        toast.success('Task created');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving task');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{task ? 'Edit Task' : 'New Task'}</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Project *</label>
              <select className="form-select" value={form.projectId} onChange={e => set('projectId', e.target.value)} required>
                <option value="">Select project…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assignee</label>
              <select className="form-select" value={form.assigneeId} onChange={e => set('assigneeId', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Status Change Modal
function StatusModal({ task, onClose, onSave }) {
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(false);
  const allowed = STATUS_NEXT[task.status] || [];

  const handleSave = async () => {
    if (!status) return;
    setLoading(true);
    try {
      await tasksApi.updateStatus(task.id, status);
      toast.success(`Status → ${status}`);
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transition not allowed');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3>Change Status</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
            Current: <Badge value={task.status} /> → Move to:
          </p>
          {allowed.length === 0
            ? <p className="text-muted">This task is in a terminal state (DONE).</p>
            : allowed.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }}>
                <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} />
                <Badge value={s} />
              </label>
            ))
          }
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!status || loading}>
            {loading ? 'Updating…' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Kanban View
function KanbanView({ tasks, onStatusClick, onEdit, onDelete, canManage }) {
  return (
    <div className="kanban">
      {STATUSES.map(status => {
        const cols = tasks.filter(t => t.status === status);
        return (
          <div className="kanban-col" key={status}>
            <div className="kanban-col-header">
              <span className={`kanban-col-title badge badge-${status.toLowerCase().replace('_','')}`}>{status.replace('_',' ')}</span>
              <span className="kanban-col-count">{cols.length}</span>
            </div>
            <div className="kanban-tasks">
              {cols.map(t => (
                <div className="task-card" key={t.id} onClick={() => onStatusClick(t)}>
                  <p className="task-card-title">{t.title}</p>
                  <div className="task-card-meta">
                    <span className={`badge badge-${t.priority.toLowerCase()}`}>{t.priority}</span>
                    <span className="task-card-assignee">
                      {t.assignee
                        ? <><span className="avatar" style={{ width: 18, height: 18, fontSize: 9 }}>{t.assignee.name[0]}</span>{t.assignee.name}</>
                        : <span style={{ color: 'var(--text2)', fontSize: 11 }}>Unassigned</span>
                      }
                    </span>
                  </div>
                  {t.dueDate && (
                    <p style={{ fontSize: 11, color: new Date(t.dueDate) < new Date() ? 'var(--danger)' : 'var(--text2)', marginTop: 6 }}>
                      � {t.dueDate}
                    </p>
                  )}
                  {canManage && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(t)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(t.id)}>Del</button>
                    </div>
                  )}
                </div>
              ))}
              {cols.length === 0 && <p style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', padding: '20px 0' }}>Empty</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// List View
function ListView({ tasks, onStatusClick, onEdit, onDelete, canManage }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due Date</th><th>Project</th>{canManage && <th>Actions</th>}</tr>
        </thead>
        <tbody>
          {tasks.length === 0
            ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>No tasks found.</td></tr>
            : tasks.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 500, maxWidth: 220 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                </td>
                <td>
                  <button className="badge" style={{ cursor: 'pointer' }} onClick={() => onStatusClick(t)}>
                    <span className={`badge badge-${t.status.toLowerCase().replace('_','')}`}>{t.status.replace('_',' ')}</span>
                  </button>
                </td>
                <td><Badge value={t.priority} /></td>
                <td>{t.assignee?.name || <span className="text-muted">Unassigned</span>}</td>
                <td style={{ color: t.dueDate && new Date(t.dueDate) < new Date() ? 'var(--danger)' : 'var(--text2)', fontSize: 12 }}>
                  {t.dueDate || '—'}
                </td>
                <td style={{ color: 'var(--text2)', fontSize: 12 }}>{t.project?.name || '—'}</td>
                {canManage && (
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(t)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(t.id)}>Delete</button>
                    </div>
                  </td>
                )}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

// Main Page
export default function TasksPage() {
  const { canManageTasks, canManageUsers, isAdmin } = useAuth();
  const { theme, toggleTheme } = useOutletContext();
  const [tasks, setTasks]           = useState([]);
  const [projects, setProjects]     = useState([]);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState('kanban');
  const [filters, setFilters]       = useState({ status: '', priority: '', assigneeId: '' });
  const [modal, setModal]           = useState(null); // null | 'create' | 'edit' | 'status'
  const [selected, setSelected]     = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 50 };
      if (filters.status)     params.status     = filters.status;
      if (filters.priority)   params.priority   = filters.priority;
      if (filters.assigneeId) params.assigneeId = filters.assigneeId;
      const res = await tasksApi.list(params);
      setTasks(res.data.data.tasks);
      setPagination(p => ({ ...p, totalPages: res.data.data.pagination.totalPages }));
    } catch { toast.error('Failed to load tasks'); }
    setLoading(false);
  }, [filters, pagination.page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    projectsApi.list({ limit: 100 }).then(r => setProjects(r.data.data.projects)).catch(() => {});
    if (canManageTasks) {
      usersApi.list({ limit: 100 }).then(r => setUsers(r.data.data.users)).catch(() => {});
    }
  }, [canManageTasks]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await tasksApi.delete(id);
      toast.success('Task deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const setFilter = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Tasks</h2>
          <p>Manage and track all tasks</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="view-toggle">
            <button className={`view-btn ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}><LayoutGrid size={14} />Board</button>
            <button className={`view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}><List size={14} />List</button>
          </div>
          {canManageTasks && (
            <button className="btn btn-primary" onClick={() => { setSelected(null); setModal('create'); }}>
              <Plus size={15} /> New Task
            </button>
          )}
          <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="filters-bar">
          <select className="filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select className="filter-select" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
          {(canManageTasks) && users.length > 0 && (
            <select className="filter-select" value={filters.assigneeId} onChange={e => setFilter('assigneeId', e.target.value)}>
              <option value="">All Assignees</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          {(filters.status || filters.priority || filters.assigneeId) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', priority: '', assigneeId: '' })}>
              <X size={13} /> Clear
            </button>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 12 }}>{tasks.length} tasks</span>
        </div>

        {loading
          ? <div className="spinner"><div className="spin" /></div>
          : view === 'kanban'
            ? <KanbanView tasks={tasks} canManage={canManageTasks} onStatusClick={t => { setSelected(t); setModal('status'); }} onEdit={t => { setSelected(t); setModal('edit'); }} onDelete={handleDelete} />
            : <ListView  tasks={tasks} canManage={canManageTasks} onStatusClick={t => { setSelected(t); setModal('status'); }} onEdit={t => { setSelected(t); setModal('edit'); }} onDelete={handleDelete} />
        }
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <TaskModal task={modal === 'edit' ? selected : null} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} projects={projects} users={users} />
      )}
      {modal === 'status' && selected && (
        <StatusModal task={selected} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />
      )}
    </>
  );
}
