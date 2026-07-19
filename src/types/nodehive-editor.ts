/**
 * Tipos TypeScript para el sistema de Visual Editor de NodeHive.
 * Importar en cualquier componente Astro que necesite tipos del editor.
 */

/** Tipos de entidad Drupal que pueden ser editadas desde el Visual Editor */
export type NodeHiveEntityType = 'paragraph' | 'nodehive_fragment' | 'node';

/**
 * Datos mínimos que todo servicio de NodeHive debe retornar
 * para que NodeHiveEntity pueda identificar la entidad en Drupal.
 */
export interface NodeHiveEntityMeta {
  /** UUID de la entidad en Drupal (data-nodehive-entity-id) */
  paragraphId?: string | null;
  /** drupal_internal__id o drupal_internal__fid (data-nodehive-entity-internal-id) */
  paragraphInternalId?: number | null;
  /** ID del nodo padre (data-nodehive-parent_id) */
  parentId?: string | number | null;
}

/**
 * Props para el componente NodeHiveEntity.
 * Cada sección editable de la página debe estar envuelta en este componente.
 */
export interface NodeHiveEntityProps {
  /** Tipo de entidad Drupal */
  entityType: NodeHiveEntityType;
  /** Bundle del paragraph o fragment (ej: "_component_home_hero", "footer_identity") */
  bundle: string;
  /** UUID de la entidad */
  id?: string | null;
  /** ID interno de Drupal */
  internalId?: number | null;
  /** ID del nodo padre que contiene esta entidad */
  parentId?: string | number | null;
  /** Código de idioma activo */
  lang?: string;
  /** Elemento HTML raíz del wrapper. Default: 'section' */
  tag?: string;
  /** Clases CSS adicionales para el wrapper */
  class?: string;
  /** Texto del botón de edición. Default: 'Editar' */
  editLabel?: string;
  /**
   * Campo Drupal que se abrirá al hacer clic en el botón de edición.
   * Si se omite, el clic abre el formulario completo del paragraph.
   * Ejemplo: "field_title", "field_hero_images"
   */
  editField?: string;
}

/**
 * Props para NodeHiveField.
 * Marca un elemento HTML como campo editable individual.
 */
export interface NodeHiveFieldProps {
  /** Nombre del campo en Drupal. Ejemplo: "field_title", "field_description" */
  field: string;
  /** Elemento HTML del wrapper. Default: 'span' */
  tag?: string;
  /** Clases CSS adicionales */
  class?: string;
}

/**
 * Props para NodeHiveEditButton.
 * Botón de edición, visible solo en modo editor.
 */
export interface NodeHiveEditButtonProps {
  /** Campo que se abrirá al hacer clic */
  field?: string;
  /** Texto del botón. Default: 'Editar' */
  label?: string;
  /**
   * Posición del botón dentro del contenedor relativo.
   * Default: 'top-right'
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Mensajes postMessage que NodeHiveConnector envía a Drupal (parent frame)
 */
export type MessageToEditor =
  | { type: 'frontend:ready'; url: string; lang: string; token: string | null }
  | { type: 'field'; field: string; id: string; pathname: string; lang: string }
  | {
      type: 'paragraph';
      uuid: string;
      id: string;
      parent_id: string;
      pathname: string;
      langcode: string;
    }
  | {
      type: 'fragment';
      uuid: string;
      id: string;
      parent_id: string;
      field: string;
      pathname: string;
      langcode: string;
    };

/**
 * Mensajes postMessage que NodeHiveConnector recibe de Drupal (parent frame)
 */
export type MessageFromEditor =
  | 'reloadFrame'
  | { type: 'nodehive-login'; token: string }
  | { type: 'editor:init' | 'editor:ready' }
  | { type: 'reload' | 'reloadFrame' }
  | { type: 'navigate'; url: string }
  | { type: 'setLang'; lang: string };
