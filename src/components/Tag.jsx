import { tagOf } from '../lib/domain';

export default function Tag({ children, cls }) {
  return <span className={'tag ' + (cls || tagOf(String(children)))}>{children}</span>;
}
