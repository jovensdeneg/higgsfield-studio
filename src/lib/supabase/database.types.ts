/**
 * Minimal Supabase Database types for the JdN FORGE project.
 * These types tell the Supabase client about our table schemas so
 * that .from("assets").update({...}) etc. work without `never` errors.
 *
 * Note: This is a simplified version. For full type safety, run
 * `npx supabase gen types typescript` against the live DB.
 */

import type { AssetStatus, AssetType, GenerationTool, JobStatus } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          style_bible_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          style_bible_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          style_bible_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          photo_urls: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          photo_urls?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          photo_urls?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          id: string;
          project_id: string;
          character_id: string | null;
          asset_code: string;
          scene: string;
          description: string;
          asset_type: AssetType;
          image_tool: GenerationTool | null;
          video_tool: GenerationTool | null;
          prompt_image: string | null;
          prompt_image1: string | null;
          prompt_image2: string | null;
          prompt_video: string | null;
          parameters: Json;
          status: AssetStatus;
          image_url: string | null;
          image1_url: string | null;
          image2_url: string | null;
          video_url: string | null;
          thumbnail_url: string | null;
          review_notes: string | null;
          error_message: string | null;
          depends_on: string | null;
          scenedescription: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          character_id?: string | null;
          asset_code: string;
          scene: string;
          description: string;
          asset_type: AssetType;
          image_tool?: GenerationTool | null;
          video_tool?: GenerationTool | null;
          prompt_image?: string | null;
          prompt_image1?: string | null;
          prompt_image2?: string | null;
          prompt_video?: string | null;
          parameters?: Json;
          status?: AssetStatus;
          image_url?: string | null;
          image1_url?: string | null;
          image2_url?: string | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          review_notes?: string | null;
          error_message?: string | null;
          depends_on?: string | null;
          scenedescription?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          character_id?: string | null;
          asset_code?: string;
          scene?: string;
          description?: string;
          asset_type?: AssetType;
          image_tool?: GenerationTool | null;
          video_tool?: GenerationTool | null;
          prompt_image?: string | null;
          prompt_image1?: string | null;
          prompt_image2?: string | null;
          prompt_video?: string | null;
          parameters?: Json;
          status?: AssetStatus;
          image_url?: string | null;
          image1_url?: string | null;
          image2_url?: string | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          review_notes?: string | null;
          error_message?: string | null;
          depends_on?: string | null;
          scenedescription?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assets_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      generation_jobs: {
        Row: {
          id: string;
          asset_id: string;
          provider: GenerationTool;
          job_type: string;
          external_task_id: string | null;
          status_url: string | null;
          status: JobStatus;
          request_payload: Json | null;
          response_payload: Json | null;
          result_url: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          asset_id: string;
          provider: GenerationTool;
          job_type: string;
          external_task_id?: string | null;
          status_url?: string | null;
          status?: JobStatus;
          request_payload?: Json | null;
          response_payload?: Json | null;
          result_url?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          asset_id?: string;
          provider?: GenerationTool;
          job_type?: string;
          external_task_id?: string | null;
          status_url?: string | null;
          status?: JobStatus;
          request_payload?: Json | null;
          response_payload?: Json | null;
          result_url?: string | null;
          error_message?: string | null;
          retry_count?: number;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "generation_jobs_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      asset_status: AssetStatus;
      asset_type: AssetType;
      generation_tool: GenerationTool;
      job_status: JobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
