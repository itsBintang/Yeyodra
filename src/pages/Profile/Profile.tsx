import { useParams } from "react-router-dom";
import { ProfileHero } from "./ProfileHero";
import { ProfileContent } from "./ProfileContent";
import "./Profile.scss";

export function Profile() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <div className="profile">
      <ProfileHero userId={userId!} />
      <ProfileContent userId={userId!} />
    </div>
  );
}
