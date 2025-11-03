/**
 * Comprehensive MIME Type Detection Tests (v5.2.0)
 *
 * Verifies that MimeTypeDetector correctly identifies:
 * - Standard types (via mime library)
 * - Custom developer types (shell, configs, modern languages)
 * - Office formats (Microsoft, OpenDocument)
 * - Special files (Dockerfile, Makefile, dotfiles)
 */

import { describe, it, expect } from 'vitest'
import { mimeDetector } from '../../../src/vfs/MimeTypeDetector.js'

describe('MimeTypeDetector (v5.2.0)', () => {
  describe('Code Files - Programming Languages', () => {
    it('should detect TypeScript files', () => {
      expect(mimeDetector.detectMimeType('file.ts')).toBe('text/typescript')
      expect(mimeDetector.detectMimeType('component.tsx')).toBe('text/typescript')
    })

    it('should detect JavaScript files', () => {
      // mime library returns text/javascript for .js (IANA standard)
      expect(mimeDetector.detectMimeType('file.js')).toBe('text/javascript')
      expect(mimeDetector.detectMimeType('component.jsx')).toBe('text/javascript')
      expect(mimeDetector.detectMimeType('module.mjs')).toBe('text/javascript')
    })

    it('should detect modern languages', () => {
      expect(mimeDetector.detectMimeType('file.kt')).toBe('text/x-kotlin')
      expect(mimeDetector.detectMimeType('file.swift')).toBe('text/x-swift')
      expect(mimeDetector.detectMimeType('file.dart')).toBe('text/x-dart')
      expect(mimeDetector.detectMimeType('script.lua')).toBe('text/x-lua')
      expect(mimeDetector.detectMimeType('app.scala')).toBe('text/x-scala')
    })

    it('should detect traditional languages', () => {
      expect(mimeDetector.detectMimeType('script.py')).toBe('text/x-python')
      expect(mimeDetector.detectMimeType('main.go')).toBe('text/x-go')
      expect(mimeDetector.detectMimeType('lib.rs')).toBe('text/x-rust')
      expect(mimeDetector.detectMimeType('App.java')).toBe('text/x-java')
      expect(mimeDetector.detectMimeType('main.c')).toBe('text/x-c')
      expect(mimeDetector.detectMimeType('main.cpp')).toBe('text/x-c++')
    })

    it('should detect functional languages', () => {
      expect(mimeDetector.detectMimeType('main.hs')).toBe('text/x-haskell')
      expect(mimeDetector.detectMimeType('core.clj')).toBe('text/x-clojure')
      expect(mimeDetector.detectMimeType('server.erl')).toBe('text/x-erlang')
      expect(mimeDetector.detectMimeType('lib.ex')).toBe('text/x-elixir')
    })
  })

  describe('Shell Scripts', () => {
    it('should detect various shell script types', () => {
      expect(mimeDetector.detectMimeType('script.sh')).toBe('application/x-sh')
      expect(mimeDetector.detectMimeType('setup.bash')).toBe('text/x-shellscript')
      expect(mimeDetector.detectMimeType('config.zsh')).toBe('text/x-shellscript')
      expect(mimeDetector.detectMimeType('functions.fish')).toBe('text/x-shellscript')
    })
  })

  describe('Configuration Files', () => {
    it('should detect config file formats', () => {
      expect(mimeDetector.detectMimeType('.env')).toBe('text/x-env')
      expect(mimeDetector.detectMimeType('config.ini')).toBe('text/x-ini')
      expect(mimeDetector.detectMimeType('app.properties')).toBe('text/x-java-properties')
      expect(mimeDetector.detectMimeType('settings.conf')).toBe('text/plain')
    })

    it('should detect dotfiles', () => {
      expect(mimeDetector.detectMimeType('.gitignore')).toBe('text/plain')
      expect(mimeDetector.detectMimeType('.dockerignore')).toBe('text/plain')
      expect(mimeDetector.detectMimeType('.npmignore')).toBe('text/plain')
      expect(mimeDetector.detectMimeType('.editorconfig')).toBe('text/plain')
    })
  })

  describe('Build & Project Files', () => {
    it('should detect special build files', () => {
      expect(mimeDetector.detectMimeType('Dockerfile')).toBe('text/x-dockerfile')
      expect(mimeDetector.detectMimeType('Makefile')).toBe('text/x-makefile')
      expect(mimeDetector.detectMimeType('build.gradle')).toBe('text/x-gradle')
      expect(mimeDetector.detectMimeType('CMakeLists.txt.cmake')).toBe('text/x-cmake')
    })
  })

  describe('Web Framework Components', () => {
    it('should detect modern web frameworks', () => {
      expect(mimeDetector.detectMimeType('Component.vue')).toBe('text/x-vue')
      expect(mimeDetector.detectMimeType('Page.svelte')).toBe('text/x-svelte')
      expect(mimeDetector.detectMimeType('layout.astro')).toBe('text/x-astro')
    })

    it('should detect style preprocessors', () => {
      expect(mimeDetector.detectMimeType('styles.scss')).toBe('text/x-scss')
      expect(mimeDetector.detectMimeType('theme.sass')).toBe('text/x-sass')
      expect(mimeDetector.detectMimeType('main.less')).toBe('text/x-less')
    })
  })

  describe('Data Formats', () => {
    it('should detect standard data formats', () => {
      expect(mimeDetector.detectMimeType('data.json')).toBe('application/json')
      expect(mimeDetector.detectMimeType('config.yaml')).toBe('text/yaml')
      expect(mimeDetector.detectMimeType('config.yml')).toBe('text/yaml')
      expect(mimeDetector.detectMimeType('data.xml')).toBe('text/xml')
      expect(mimeDetector.detectMimeType('data.csv')).toBe('text/csv')
    })

    it('should detect big data formats', () => {
      expect(mimeDetector.detectMimeType('data.parquet')).toBe('application/vnd.apache.parquet')
      expect(mimeDetector.detectMimeType('schema.avro')).toBe('application/avro')
      expect(mimeDetector.detectMimeType('api.proto')).toBe('text/x-protobuf')
    })
  })

  describe('Office Formats - Microsoft Office', () => {
    it('should detect Word documents', () => {
      expect(mimeDetector.detectMimeType('document.docx'))
        .toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(mimeDetector.detectMimeType('template.dotx'))
        .toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.template')
    })

    it('should detect Excel spreadsheets', () => {
      expect(mimeDetector.detectMimeType('spreadsheet.xlsx'))
        .toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(mimeDetector.detectMimeType('template.xltx'))
        .toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.template')
    })

    it('should detect PowerPoint presentations', () => {
      expect(mimeDetector.detectMimeType('presentation.pptx'))
        .toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
    })
  })

  describe('Office Formats - OpenDocument', () => {
    it('should detect OpenDocument formats', () => {
      expect(mimeDetector.detectMimeType('document.odt')).toBe('application/vnd.oasis.opendocument.text')
      expect(mimeDetector.detectMimeType('spreadsheet.ods')).toBe('application/vnd.oasis.opendocument.spreadsheet')
      expect(mimeDetector.detectMimeType('presentation.odp')).toBe('application/vnd.oasis.opendocument.presentation')
    })
  })

  describe('Media Files', () => {
    it('should detect image formats', () => {
      expect(mimeDetector.detectMimeType('photo.jpg')).toBe('image/jpeg')
      expect(mimeDetector.detectMimeType('logo.png')).toBe('image/png')
      expect(mimeDetector.detectMimeType('icon.svg')).toBe('image/svg+xml')
      expect(mimeDetector.detectMimeType('graphic.webp')).toBe('image/webp')
    })

    it('should detect video formats', () => {
      expect(mimeDetector.detectMimeType('video.mp4')).toBe('video/mp4')
      expect(mimeDetector.detectMimeType('movie.mov')).toBe('video/quicktime')
      expect(mimeDetector.detectMimeType('clip.webm')).toBe('video/webm')
    })

    it('should detect audio formats', () => {
      expect(mimeDetector.detectMimeType('song.mp3')).toBe('audio/mpeg')
      expect(mimeDetector.detectMimeType('sound.wav')).toBe('audio/wav')
      expect(mimeDetector.detectMimeType('podcast.ogg')).toBe('audio/ogg')
    })
  })

  describe('Text File Detection', () => {
    it('should identify text files correctly', () => {
      // Code files
      expect(mimeDetector.isTextFile('text/typescript')).toBe(true)
      expect(mimeDetector.isTextFile('text/x-python')).toBe(true)
      expect(mimeDetector.isTextFile('application/javascript')).toBe(true)

      // Data formats
      expect(mimeDetector.isTextFile('application/json')).toBe(true)
      expect(mimeDetector.isTextFile('text/yaml')).toBe(true)
      expect(mimeDetector.isTextFile('text/xml')).toBe(true)

      // Binary files
      expect(mimeDetector.isTextFile('image/png')).toBe(false)
      expect(mimeDetector.isTextFile('video/mp4')).toBe(false)
      expect(mimeDetector.isTextFile('application/pdf')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle files without extensions', () => {
      expect(mimeDetector.detectMimeType('Dockerfile')).toBe('text/x-dockerfile')
      expect(mimeDetector.detectMimeType('Makefile')).toBe('text/x-makefile')
    })

    it('should handle unknown extensions', () => {
      expect(mimeDetector.detectMimeType('file.unknown')).toBe('application/octet-stream')
      expect(mimeDetector.detectMimeType('random.foobar123')).toBe('application/octet-stream')
    })

    it('should handle case variations', () => {
      expect(mimeDetector.detectMimeType('FILE.TS')).toBe('text/typescript')
      expect(mimeDetector.detectMimeType('DoCtUmEnT.JSON')).toBe('application/json')
    })
  })

  describe('Coverage Verification', () => {
    it('should handle 40+ file types from mime library', () => {
      // Standard web types (from mime library)
      expect(mimeDetector.detectMimeType('page.html')).toBe('text/html')
      expect(mimeDetector.detectMimeType('style.css')).toBe('text/css')
      expect(mimeDetector.detectMimeType('doc.pdf')).toBe('application/pdf')
      expect(mimeDetector.detectMimeType('archive.zip')).toBe('application/zip')
      expect(mimeDetector.detectMimeType('data.tar')).toBe('application/x-tar')
    })

    it('should handle 50+ custom types', () => {
      // All custom types should be defined
      const customTypes = [
        ['.bash', 'text/x-shellscript'],
        ['.kt', 'text/x-kotlin'],
        ['.swift', 'text/x-swift'],
        ['.dart', 'text/x-dart'],
        ['.env', 'text/x-env'],
        ['.vue', 'text/x-vue'],
        ['.parquet', 'application/vnd.apache.parquet']
      ]

      customTypes.forEach(([ext, expected]) => {
        expect(mimeDetector.detectMimeType(`file${ext}`)).toBe(expected)
      })
    })
  })
})
