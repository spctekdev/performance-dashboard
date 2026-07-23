import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from "typeorm";
import { User } from "./User";
import { ChatMessage } from "./ChatMessage";

@Entity("chat_sessions")
@Index(["userId", "lastMessageAt"])
export class ChatSession {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "uuid" }) userId!: string;
  @ManyToOne(() => User, { onDelete: "CASCADE" }) @JoinColumn({ name: "userId" }) user!: Relation<User>;
  @Column({ type: "varchar", length: 120 }) title!: string;
  @Column({ type: "boolean", default: false }) archived!: boolean;
  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" }) lastMessageAt!: Date;
  @OneToMany(() => ChatMessage, (message) => message.session) messages!: Relation<ChatMessage[]>;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
