"use client";

import { useEffect, useState } from "react";
import CharacterCard from "@/components/CharacterCard";
import EmptyState from "@/components/EmptyState";

interface Character {
  character_id: string;
  name: string;
  description: string;
  photos: { url: string }[];
  created_at: string;
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  async function fetchCharacters() {
    try {
      const res = await fetch("/api/characters");
      if (res.ok) {
        const data = await res.json();
        setCharacters(data.characters ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchCharacters(); }, []);

  async function handleCreate() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setNewDesc("");
        setShowForm(false);
        fetchCharacters();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao criar personagem");
      }
    } catch { alert("Erro de rede"); }
    finally { setCreating(false); }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
          <p className="text-sm text-slate-400">Carregando personagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Personagens</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gerencie personagens com fotos de referência para consistência nas gerações
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Personagem
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Criar Novo Personagem</h3>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Nome</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Breno"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Descrição (opcional)</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Ex: Apresentador principal do canal"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {creating && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {creating ? "Criando..." : "Criar Personagem"}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(""); setNewDesc(""); }}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Characters Grid */}
      {characters.length === 0 ? (
        <EmptyState
          title="Nenhum personagem criado"
          description="Crie personagens com fotos de referência para manter consistência nas gerações de imagem."
          actionLabel="Criar Primeiro Personagem"
          actionHref="#"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((char) => (
            <CharacterCard key={char.character_id} character={char} />
          ))}
        </div>
      )}
    </div>
  );
}
