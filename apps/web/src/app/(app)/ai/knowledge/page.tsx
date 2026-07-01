'use client';

import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@atlas/ui';

import { DataTable, StatusBadge } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { FormError, PageEmpty, PageError, PageLoading } from '@/components/page-states';
import { useOrgContext } from '@/hooks/use-org-context';
import { ApiError, aiMemoryApi } from '@/lib/api-client';
import { fieldError } from '@/lib/form-utils';
import type { KnowledgeDocument } from '@/lib/api-types';

function chunkPreviewText(chunk: Record<string, unknown>): string {
  const text = chunk.textContent ?? chunk.text_content;
  return typeof text === 'string' ? text : '';
}

export default function KnowledgeBasePage() {
  const { accessToken, organizationId } = useOrgContext();
  const [documents, setDocuments] = React.useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [rawContent, setRawContent] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<
    Array<{ chunk: Record<string, unknown>; score: number }>
  >([]);
  const [searching, setSearching] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await aiMemoryApi.listKnowledgeDocuments(accessToken, organizationId);
      setDocuments([...result.data]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load knowledge documents.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(event: React.SubmitEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      const body: {
        title: string;
        description?: string;
        raw_content?: string;
        auto_chunk?: boolean;
      } = { title, auto_chunk: true };

      const trimmedDescription = description.trim();
      const trimmedContent = rawContent.trim();
      if (trimmedDescription.length > 0) {
        body.description = trimmedDescription;
      }
      if (trimmedContent.length > 0) {
        body.raw_content = trimmedContent;
      }

      await aiMemoryApi.uploadKnowledgeDocument(accessToken, organizationId, body);
      setTitle('');
      setDescription('');
      setRawContent('');
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setFormError('Failed to upload document.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSearch(event: React.SubmitEvent) {
    event.preventDefault();
    if (searchQuery.trim().length === 0) {
      return;
    }

    setSearching(true);
    try {
      const result = await aiMemoryApi.searchMemory(accessToken, organizationId, {
        query: searchQuery,
        limit: 10,
      });
      setSearchResults([...result.results]);
    } catch (err) {
      setSearchResults([]);
      setError(err instanceof ApiError ? err.message : 'Search failed.');
    } finally {
      setSearching(false);
    }
  }

  if (loading) {
    return <PageLoading label="Loading knowledge base..." />;
  }

  if (error && documents.length === 0) {
    return <PageError message={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Upload documents and search organizational memory with hybrid semantic retrieval."
        actions={
          <Button onClick={() => { setShowForm((value) => !value); }}>
            {showForm ? 'Cancel' : 'Upload Document'}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Semantic Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { void handleSearch(event); }}>
            <Input
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); }}
              placeholder="Search memory and knowledge..."
              className="flex-1"
            />
            <Button type="submit" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </form>
          {searchResults.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {searchResults.map((result, index) => (
                <li key={index} className="rounded-md border border-border-subtle p-3 text-body-sm">
                  <p className="font-medium text-foreground-secondary">
                    Score: {result.score.toFixed(2)}
                  </p>
                  <p className="mt-1 text-foreground-primary">
                    {chunkPreviewText(result.chunk)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => { void handleUpload(event); }}>
              {formError ? <FormError message={formError} /> : null}
              <Input
                label="Title"
                required
                value={title}
                onChange={(event) => { setTitle(event.target.value); }}
                {...fieldError(fieldErrors, 'title')}
                disabled={submitting}
              />
              <div>
                <label className="text-label-sm text-foreground-secondary">Description</label>
                <Input
                  value={description}
                  onChange={(event) => { setDescription(event.target.value); }}
                />
              </div>
              <div>
                <label className="text-label-sm text-foreground-secondary">Content</label>
                <textarea
                  value={rawContent}
                  onChange={(event) => { setRawContent(event.target.value); }}
                  rows={8}
                  placeholder="Paste document text for chunking and embedding..."
                  className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-body-md"
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Uploading...' : 'Upload & Chunk'}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {documents.length === 0 ? (
        <PageEmpty
          title="No documents yet"
          description="Upload your first knowledge document to enable RAG retrieval."
        />
      ) : (
        <DataTable
          data={documents}
          columns={[
            { key: 'title', header: 'Title', cell: (row) => row.title },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => <StatusBadge status={row.status} />,
            },
            { key: 'chunkCount', header: 'Chunks', cell: (row) => String(row.chunkCount) },
            {
              key: 'updatedAt',
              header: 'Updated',
              cell: (row) => new Date(row.updatedAt).toLocaleDateString(),
            },
          ]}
        />
      )}
    </div>
  );
}