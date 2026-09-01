# `@vibechat/space-app-dependencies`

Portable, fail-closed dependency resolution for `agentos-app-v1` Space
Projects. A Project uses ordinary package imports and exact versions in
`package.json`, while `space-app-dependencies.json` pins the corresponding
managed artifact integrity.

The Runtime resolves those pins through an injected managed Registry, verifies
the returned package files, materializes them into an isolated build tree and
rewrites only that build tree to local `file:` dependencies. Stored Project
source, existing ready Revisions and Published Releases are never rewritten.
Production browsers never contact npm or a CDN.

Projects without `space-app-dependencies.json` are returned unchanged. A lock
is required when `package.json` references a package in a managed scope such as
`@vibechat/*`.

```json
{
  "schemaVersion": "vibechat.space-app-dependencies/v1",
  "packages": {
    "@vibechat/space-app-components": {
      "version": "0.5.0",
      "integrity": "sha256:9754fd6cb4b084c3c23c7f945a4e8784192ed04aa2b1b3fb8517bc8b4e780049"
    }
  }
}
```

`prepareSpaceAppProject()` produces `vibechat.prepared-space-app-project/v1`
with source/artifact hashes, verified package metadata and Dev import paths.
`assertPreparedSpaceAppProject()` revalidates the source binding, all generated
files, resolved manifest, each package integrity and the reconstructed import
map before a cached artifact can be reused. Registry implementations are
injected; this package never performs network access itself.

The managed Registry record is immutable by package name and exact version. It
binds integrity, supported Project formats and the content-addressed Object
Store key/hash of a canonical, versioned JSON package envelope. Publish verifies
the package file tree before storage; resolve verifies the database pointer,
object hash, envelope metadata and reconstructed file integrity before returning
an artifact. Public npm or another npm-compatible registry may mirror a tarball
of the same package, but Space Runtime does not depend on that mirror while
preparing a Project.
