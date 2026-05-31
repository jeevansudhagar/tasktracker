import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksApi, projectsApi, analyticsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { CheckSquare, FolderOpen, Clock, AlertTriangle, TrendingUp } from 'lucide-react';

const STATUS_COLORS = {
  TODO:'var(--accent)', IN_PROGRESS:'var(--warning)', IN_REVIEW:'var(--info)', DONE:'var(--success)', BLOCKED:'var(--danger)'
};

export default function DashboardPage() {
  const { user, isAdmin, isManager, canManageTasks } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ tasks: 0, todo: 0, inProgress: 0, done: 0, blocked: 0, projects: 0 });
  const [recentTasks, setRecentTasks]       = useState([]);
  const [overdueData, setOverdueData]       = useState([]);
  const [breakdown, setBreakdown]           = useState([]);
  const [loading, setLoading]               = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [tasksRes, projectsRes] = await Promise.all([
          tasksApi.list({ limit: 5, page: 1 }),
          projectsApi.list({ limit: 100 }),
        ]);
        const tasks    = tasksRes.data.data.tasks;
        const projects = projectsRes.data.data.projects;
        setRecentTasks(tasks);
        setStats({
          tasks:      tasksRes.data.data.pagination.total,
          todo:       tasks.filter(t => t.status === 'TODO').length,
          inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
          done:       tasks.filter(t => t.status === 'DONE').length,
          blocked:    tasks.filter(t => t.status === 'BLOCKED').length,
          projects:   projects.length,
        });

        if (canManageTasks) {
          const [ovRes, bkRes] = await Promise.all([
            analyticsApi.overdueSummary(),
            analyticsApi.taskStatusBreakdown(),
          ]);
          setOverdueData(ovRes.data.data.overdueSummary?.slice(0, 5) || []);
          setBreakdown(bkRes.data.data.breakdown || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [canManageTasks]);

  if (loading) return <div className="spinner"><div className="spin" /></div>;

  const statCards = [
    { label: 'Total Tasks',  value: stats.tasks,      icon: <CheckSquare size={20} />, bg: 'rgba(99,102,241,0.15)',  color: 'var(--accent)' },
    { label: 'In Progress',  value: stats.inProgress, icon: <Clock size={20} />,       bg: 'rgba(245,158,11,0.15)', color: 'var(--warning)' },
    { label: 'Completed',    value: stats.done,        icon: <TrendingUp size={20} />,  bg: 'rgba(16,185,129,0.15)', color: 'var(--success)' },
    { label: 'Blocked',      value: stats.blocked,     icon: <AlertTriangle size={20} />,bg:'rgba(239,68,68,0.15)', color: 'var(--danger)' },
    { label: 'Projects',     value: stats.projects,    icon: <FolderOpen size={20} />,  bg: 'rgba(59,130,246,0.15)', color: 'var(--info)' },
  ];

  // Build unique projects from breakdown
  const projectMap = {};
  breakdown.forEach(r => {
    if (!projectMap[r.projectId]) projectMap[r.projectId] = { name: r.projectName, statuses: {} };
    if (r.status) projectMap[r.projectId].statuses[r.status] = r.count;
  });
  const projectBreakdown = Object.entries(projectMap).slice(0, 4);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Welcome back, {user?.name} · {user?.role}</p>
        </div>
      </div>
      <div className="page-body">

        {/* Stat Cards */}
        <div className="stats-grid">
          {statCards.map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Recent Tasks */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Recent Tasks</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>View all</button>
            </div>
            {recentTasks.length === 0
              ? <p className="text-muted">No tasks yet.</p>
              : recentTasks.map(t => (
                <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[t.status], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                    <p className="text-muted">{t.assignee?.name || 'Unassigned'}</p>
                  </div>
                  <span className={`badge badge-${t.priority.toLowerCase()}`}>{t.priority}</span>
                </div>
              ))
            }
          </div>

          {/* Overdue Summary (ADMIN/MANAGER) */}
          {canManageTasks && (
            <div className="card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Overdue by User</h3>
              {overdueData.length === 0
                ? <p className="text-muted">No overdue tasks </p>
                : overdueData.map(u => (
                  <div key={u.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                      {u.userName?.charAt(0)?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{u.userName}</p>
                      <p className="text-muted">{u.userEmail}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: u.overdueCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {u.overdueCount} overdue
                    </span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Project Status Breakdown */}
        {canManageTasks && projectBreakdown.length > 0 && (
          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Project Status Breakdown</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {projectBreakdown.map(([id, p]) => (
                <div key={id} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{p.name}</p>
                  {Object.entries(p.statuses).map(([status, count]) => (
                    <div key={status} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: STATUS_COLORS[status] }}>{status.replace('_', ' ')}</span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
