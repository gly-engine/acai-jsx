import type { GlyStd } from '@gamely/gly-types';
import { createState, Rect, Text, TextBlock } from '../../src';

export const meta = {
  title: 'Acai JSX Sample',
  Author: 'RodrigoDornelles',
  version: '0.0.0'
}

const [getCount, setCount] = createState(0);
const getCountFormated = () => `Key events: ${getCount()}`;

const Button = (props: { label: string | (() => string), color: number }, std: GlyStd) => <node>
  <Rect backgroundColor={props.color} radius={8}/>
  <Text>{props.label}</Text>
</node>

export const callbacks = {
  load: (_: never, std: GlyStd) => {
    /**
     * stylesheet
     */
    <style class='500w' width={500} />;
    <style class='margin10' margin={10} />;

    /**
     * markup
     */
    <grid class='1x12' style='500w'>
      <Text align='center'>{meta.title}</Text>
      <grid class='12x1'>
        <Text align='left' content='align left' span={4} />
        <Text align='center' content='centered' span={4} />
        <Text align='right' content='align right' span={4} />
      </grid>
      <TextBlock align={"justify"} span={2}>
        Lorem ipsum dolor sit amet. Est necessitatibus necessitatibus aut doloribus neque aut dolorum dolor 33 dignissimos veniam 33 harum vero.
        Qui dolorem deserunt aut architecto rerum aut rerum autem quo voluptatum veritatis sed amet saepe sit doloribus ratione At perferendis rerum.
        Sed quibusdam deserunt a totam illum vel obcaecati recusandae.
        
        Et explicabo consequatur aut quae Quis est officiis repellat.
        Qui earum libero non iste facilis ut quia sint et quam necessitatibus qui fuga impedit est exercitationem facilis.
        A quod assumenda eos ipsa perferendis est voluptatum doloremque At magnam quia ut magnam internos.
        Qui sunt harum a architecto mollitia qui aliquid obcaecati et ullam quia id dolorem laudantium qui nulla similique non eligendi dolorem.
      </TextBlock>
      <item style='margin10'>
        <Button label={getCountFormated} color={std.color.blue}/>
      </item>
    </grid>
  },
  key: (_: never, std: GlyStd, key: string, press: boolean) => {
    setCount(count => count + 1);
  },
  error: (_: never, std: GlyStd, message: string) => {
    std.log.error(message);
  }
}
