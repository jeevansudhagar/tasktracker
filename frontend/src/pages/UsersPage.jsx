import { useEffect, useState, useCallback } from 'react';
import { usersApi } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { X, Users, Moon, Sun } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({ name: user?.name || '', role: user?.role || 'MEMBER', isActive: user?.isActive ?? true });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await usersApi.update(user.id, form);
      toast.success('User updated');
      onSave();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>Edit User</h3>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option>ADMIN</option><option>MANAGER</option><option>MEMBER</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={String(form.isActive)} onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'true' }))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
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

export default function UsersPage() {
  const { canManageUsers, user: me } = useAuth();
  const { theme, toggleTheme } = useOutletContext();
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (roleFilter) params.role = roleFilter;
      const r = await usersApi.list(params);
      setUsers(r.data.data.users);
    } catch { toast.error('Failed to load users'); }
    setLoading(false);
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    try { await usersApi.delete(id); toast.success('User deactivated'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  return (
    <>
      <div className="page-header">
        <div><h2>Users</h2><p>Manage organization members</p></div>
        <button className="btn-icon" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      <div className="page-body">
        <div className="filters-bar mb-4">
          <select className="filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option>ADMIN</option><option>MANAGER</option><option>MEMBER</option>
          </select>
          <span style={{ marginLeft: 'auto', color: 'var(--text2)', fontSize: 12 }}>{users.length} users</span>
        </div>

        {loading
          ? <div className="spinner"><div className="spin" /></div>
          : users.length === 0
            ? <div className="empty-state"><Users size={48} /><p>No users found</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th>{canManageUsers && <th>Actions</th>}</tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                              {u.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p style={{ fontWeight: 600, fontSize: 13 }}>{u.name} {u.id === me?.id && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>(you)</span>}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>{u.email}</td>
                        <td><span className={`badge badge-${u.role.toLowerCase()}`}>{u.role}</span></td>
                        <td><span className={`badge ${u.isActive ? 'badge-done' : 'badge-blocked'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                        <td style={{ color: 'var(--text2)', fontSize: 12 }}>
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                        </td>
                        {canManageUsers && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(u)}>Edit</button>
                              {u.id !== me?.id && u.isActive && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(u.id)}>Deactivate</button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {selected && (
        <UserModal user={selected} onClose={() => setSelected(null)} onSave={() => { setSelected(null); load(); }} />
      )}
    </>
  );
}
