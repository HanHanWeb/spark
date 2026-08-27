import type { IconKey } from "@/lib/notes";
import {
  Lightbulb,
  ListTodo,
  Brain,
  BookOpen,
  Zap,
  Star,
  Heart,
  Flag,
  Bookmark,
  Coffee,
  Music,
  Camera,
} from "lucide-react";

/** 模块级静态映射，返回的元素在编译期即可确定，规避 react-hooks/static-components */
export function CategoryIcon({
  name,
  className,
}: {
  name: IconKey;
  className?: string;
}) {
  switch (name) {
    case "lightbulb":
      return <Lightbulb className={className} />;
    case "listTodo":
      return <ListTodo className={className} />;
    case "brain":
      return <Brain className={className} />;
    case "bookOpen":
      return <BookOpen className={className} />;
    case "zap":
      return <Zap className={className} />;
    case "star":
      return <Star className={className} />;
    case "heart":
      return <Heart className={className} />;
    case "flag":
      return <Flag className={className} />;
    case "bookmark":
      return <Bookmark className={className} />;
    case "coffee":
      return <Coffee className={className} />;
    case "music":
      return <Music className={className} />;
    case "camera":
      return <Camera className={className} />;
    default:
      return <Lightbulb className={className} />;
  }
}
